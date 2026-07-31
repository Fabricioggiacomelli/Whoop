import { beforeAll, describe, expect, it, vi } from "vitest";

import { createSignedState, decryptToken, encryptToken, verifySignedState } from "@/server/whoop/whoop.auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-for-state-signing";
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64); // 32 bytes em hex
});

describe("createSignedState / verifySignedState (proteção CSRF do OAuth)", () => {
  it("accepts a state it just signed", () => {
    const state = createSignedState();
    expect(verifySignedState(state)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const state = createSignedState();
    const [nonce, timestamp] = state.split(".");
    const tampered = `${nonce}.${timestamp}.${"0".repeat(64)}`;
    expect(verifySignedState(tampered)).toBe(false);
  });

  it("rejects a state signed with a different secret", () => {
    const state = createSignedState();
    process.env.AUTH_SECRET = "a-completely-different-secret";
    expect(verifySignedState(state)).toBe(false);
    process.env.AUTH_SECRET = "test-auth-secret-for-state-signing";
  });

  it("rejects malformed state strings", () => {
    expect(verifySignedState("not-a-valid-state")).toBe(false);
    expect(verifySignedState("")).toBe(false);
  });

  it("rejects an expired state", () => {
    vi.useFakeTimers();
    const state = createSignedState();
    vi.advanceTimersByTime(11 * 60 * 1000); // > 10 min de TTL
    expect(verifySignedState(state)).toBe(false);
    vi.useRealTimers();
  });
});

describe("encryptToken / decryptToken (AES-256-GCM)", () => {
  it("round-trips a plaintext token", () => {
    const plain = "whoop-access-token-abc123";
    const encrypted = encryptToken(plain);
    expect(encrypted).not.toContain(plain);
    expect(decryptToken(encrypted)).toBe(plain);
  });

  it("produces a different ciphertext each time (random IV) even for the same input", () => {
    const a = encryptToken("same-value");
    const b = encryptToken("same-value");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt if the ciphertext was tampered with", () => {
    const encrypted = encryptToken("sensitive-token");
    const [iv, tag, data] = encrypted.split(":");
    const tamperedData = data.slice(0, -2) + (data.slice(-2) === "00" ? "11" : "00");
    expect(() => decryptToken(`${iv}:${tag}:${tamperedData}`)).toThrow();
  });
});
