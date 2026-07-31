import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id com parâmetros OWASP para hashing interativo de senha (m=19MiB, t=2, p=1).
 * Ver SECURITY.md §2.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hashedPassword: string, plainPassword: string): Promise<boolean> {
  try {
    return await verify(hashedPassword, plainPassword);
  } catch {
    // hash malformado/corrompido nunca deve derrubar o fluxo de login — apenas nega o acesso.
    return false;
  }
}
