import { createHmac } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "@/server/whoop/whoop.webhook";

const SECRET = "test-webhook-secret";

function sign(timestamp: string, rawBody: string, secret = SECRET) {
  return createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
}

beforeAll(() => {
  process.env.WHOOP_WEBHOOK_SECRET = SECRET;
});

describe("verifyWebhookSignature", () => {
  const rawBody = JSON.stringify({ user_id: 999, id: "abc", type: "sleep.updated", trace_id: "t-1" });
  const timestamp = "1785500000000";

  it("accepts a correctly computed signature (timestamp + rawBody, base64 HMAC-SHA256)", () => {
    const signature = sign(timestamp, rawBody);
    expect(verifyWebhookSignature(rawBody, timestamp, signature)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const signature = sign(timestamp, rawBody, "wrong-secret");
    expect(verifyWebhookSignature(rawBody, timestamp, signature)).toBe(false);
  });

  it("rejects when the body was modified after signing (integrity)", () => {
    const signature = sign(timestamp, rawBody);
    const modifiedBody = rawBody.replace("sleep.updated", "sleep.deleted");
    expect(verifyWebhookSignature(modifiedBody, timestamp, signature)).toBe(false);
  });

  it("rejects when the timestamp was modified (prevents replay with a shifted timestamp)", () => {
    const signature = sign(timestamp, rawBody);
    expect(verifyWebhookSignature(rawBody, "1785500099999", signature)).toBe(false);
  });

  it("rejects when headers are missing", () => {
    expect(verifyWebhookSignature(rawBody, "", "")).toBe(false);
  });

  it("never throws on garbage input — always denies instead", () => {
    expect(() => verifyWebhookSignature(rawBody, timestamp, "not-base64-!!!")).not.toThrow();
  });
});
