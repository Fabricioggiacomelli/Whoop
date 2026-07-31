import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem UPSTASH_REDIS_REST_URL/TOKEN no ambiente de teste, o módulo cai para o limitador em
// memória — exatamente o comportamento de desenvolvimento local sem Redis configurado.
describe("rate limiter (fallback em memória)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows requests under the limit", async () => {
    const { loginRateLimiter } = await import("@/lib/rate-limit");
    const identifier = `test-${Math.random()}`;

    for (let i = 0; i < 5; i++) {
      const { success } = await loginRateLimiter.limit(identifier);
      expect(success).toBe(true);
    }
  });

  it("blocks the request after the limit is exceeded", async () => {
    const { loginRateLimiter } = await import("@/lib/rate-limit");
    const identifier = `test-${Math.random()}`;

    for (let i = 0; i < 5; i++) {
      await loginRateLimiter.limit(identifier);
    }

    const { success } = await loginRateLimiter.limit(identifier);
    expect(success).toBe(false);
  });

  it("tracks identifiers independently", async () => {
    const { loginRateLimiter } = await import("@/lib/rate-limit");

    for (let i = 0; i < 5; i++) {
      await loginRateLimiter.limit("user-a");
    }

    const blockedA = await loginRateLimiter.limit("user-a");
    const allowedB = await loginRateLimiter.limit("user-b");

    expect(blockedA.success).toBe(false);
    expect(allowedB.success).toBe(true);
  });
});
