import NextAuth from "next-auth";

import { authConfig } from "@/server/auth.config";

/**
 * Convenção `proxy.ts` (Next.js 16, substitui `middleware.ts`) — sempre roda em runtime
 * Node.js. Usa `authConfig` (sem Prisma/Argon2 acoplado) por composição, não por
 * necessidade de Edge: é um gate rápido de UX (redireciona não-autenticados antes de
 * renderizar a página); a autorização real por papel é sempre reconferida no servidor
 * (Server Component/Action), nunca confiada só a este proxy — ver SECURITY.md §3.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: [
    "/home/:path*",
    "/ranking/:path*",
    "/categorias/:path*",
    "/evolucao/:path*",
    "/metas/:path*",
    "/journal/:path*",
    "/perfil/:path*",
    "/onboarding/:path*",
    "/display/:path*",
    "/admin/:path*",
  ],
};
