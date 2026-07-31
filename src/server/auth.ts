import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { db } from "@/server/db";
import { verifyPassword } from "@/lib/password";
import { loginRateLimiter } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { authConfig } from "@/server/auth.config";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

/**
 * Estratégia de sessão: JWT, não banco.
 *
 * O Auth.js/NextAuth não suporta de forma confiável sessões em banco combinadas com o
 * Credentials provider (a estratégia "database" foi desenhada para providers OAuth, que
 * criam um `Account` vinculado — o Credentials não cria esse vínculo). Em vez disso,
 * revogação "instantânea" é obtida revalidando o usuário contra o banco a cada leitura de
 * sessão (callback `session` abaixo): se o admin suspender/remover o usuário, a próxima
 * requisição autenticada já falha, mesmo com um JWT ainda criptograficamente válido.
 * `maxAge` curto limita ainda mais a janela de exposição. Ver SECURITY.md §2.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12, // 12h
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        const { success } = await loginRateLimiter.limit(`${ip}:${email}`);
        if (!success) {
          logger.warn("auth.login_rate_limited", { email });
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
          include: { profile: true },
        });

        if (!user || user.status !== "ACTIVE" || user.deletedAt) {
          logger.warn("auth.login_failed", { email, reason: "user_not_active" });
          return null;
        }

        const isValid = await verifyPassword(user.passwordHash, password);
        if (!isValid) {
          logger.warn("auth.login_failed", { email, reason: "bad_password" });
          return null;
        }

        logger.info("auth.login_success", { userId: user.id });

        return {
          id: user.id,
          email: user.email,
          name: user.profile?.displayName ?? user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = token.uid as string | undefined;
      if (!userId) return session;

      const dbUser = await db.user.findUnique({ where: { id: userId } });
      if (!dbUser || dbUser.status !== "ACTIVE" || dbUser.deletedAt) {
        // Sessão revogada — Auth.js trata retorno vazio como "sem sessão válida".
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }

      session.user.id = dbUser.id;
      session.user.role = dbUser.role;
      return session;
    },
  },
});
