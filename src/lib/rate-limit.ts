import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/server/redis";

/**
 * Fallback em memória para desenvolvimento local sem Upstash configurado.
 * NÃO é adequado para produção multi-instância (o estado não é compartilhado entre
 * processos) — em produção, `UPSTASH_REDIS_REST_URL`/`TOKEN` devem estar configurados,
 * o que faz este módulo usar o `Ratelimit` real do Upstash.
 */
class InMemoryRateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  async limit(identifier: string) {
    const now = Date.now();
    const entry = this.hits.get(identifier);

    if (!entry || entry.resetAt < now) {
      this.hits.set(identifier, { count: 1, resetAt: now + this.windowMs });
      return { success: true, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { success: false, remaining: 0 };
    }

    entry.count += 1;
    return { success: true, remaining: this.maxRequests - entry.count };
  }
}

function buildLimiter(limit: number, windowSeconds: number) {
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: false,
    });
  }

  return new InMemoryRateLimiter(limit, windowSeconds * 1000);
}

// 5 tentativas de login a cada 5 minutos, por identificador (IP + e-mail combinados no caller).
export const loginRateLimiter = buildLimiter(5, 300);

// Callback de OAuth/webhook da WHOOP: janela mais generosa, mas ainda protegida.
export const whoopWebhookRateLimiter = buildLimiter(60, 60);

// "Puxar para atualizar": 1 sync manual a cada 20s por usuário — suficiente pro gesto,
// baixo o bastante para não martelar a API da WHOOP.
export const whoopManualSyncRateLimiter = buildLimiter(1, 20);
