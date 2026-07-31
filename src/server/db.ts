import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

/**
 * Singleton do Prisma Client. Em desenvolvimento, o Next.js recarrega módulos a cada
 * mudança de arquivo (HMR) — sem isso, cada reload abriria uma nova pool de conexões
 * contra o Postgres até esgotar o limite do banco.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL,
      // Recicla conexões ociosas proativamente — bancos serverless (Neon, e o Postgres
      // efêmero do `prisma dev`) derrubam conexões ociosas do próprio lado, e um cliente
      // "morto" ainda no pool derruba a próxima query com "Connection terminated
      // unexpectedly" em vez de simplesmente ser substituído.
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      // O `prisma dev` local roda sobre um Postgres embarcado (PGlite) atrás de um proxy
      // fino de conexão única — um pool grande contra ele é a causa mais provável das
      // quedas "Connection terminated unexpectedly" observadas em uso real. Um pool
      // pequeno é mais que suficiente para 4 usuários e reduz a pressão sobre o proxy.
      max: 3,
    },
    {
      // Sem isto, o erro de uma conexão ociosa encerrada pelo servidor vira um evento
      // 'error' não tratado no pool — que pode derrubar o processo Node inteiro.
      onPoolError: (error) => logger.warn("db.pool_error", { message: error.message }),
      onConnectionError: (error) => logger.warn("db.connection_error", { message: error.message }),
    },
  );

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
