import { Redis } from "@upstash/redis";

/**
 * Cliente Redis (Upstash) para cache, filas leves e rate limiting.
 *
 * Em desenvolvimento local sem credenciais Upstash configuradas, `redis` fica `null` e
 * `src/lib/rate-limit.ts` cai para um limitador em memória — o projeto continua executável
 * sem depender de infraestrutura externa (seção 38 do brief: usar mocks enquanto credenciais
 * não estiverem configuradas).
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

export const redis = createRedisClient();
