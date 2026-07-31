import type { NextAuthConfig } from "next-auth";

/**
 * Configuração enxuta: nada aqui toca Prisma, Redis ou o binário nativo do Argon2 — é a
 * metade do config usada por `proxy.ts` (gate de rotas). A configuração completa (adapter,
 * provider Credentials, callbacks com acesso ao banco) vive em `auth.ts`, usada em Server
 * Actions, Route Handlers e Server Components.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // populado em auth.ts
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      const isAdminRoute = pathname.startsWith("/admin");
      const isProtectedAppRoute =
        pathname.startsWith("/home") ||
        pathname.startsWith("/ranking") ||
        pathname.startsWith("/categorias") ||
        pathname.startsWith("/evolucao") ||
        pathname.startsWith("/metas") ||
        pathname.startsWith("/journal") ||
        pathname.startsWith("/perfil") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/display");

      if (isAdminRoute) {
        return isLoggedIn && auth?.user.role === "ADMIN";
      }

      if (isProtectedAppRoute) {
        return isLoggedIn;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
