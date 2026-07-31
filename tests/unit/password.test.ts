import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing (Argon2id)", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("never returns the plain password inside the hash", async () => {
    const plain = "correct horse battery staple";
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
    expect(hash.startsWith("$argon2")).toBe(true);
  });

  it("does not throw on a malformed hash — just denies access", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});
