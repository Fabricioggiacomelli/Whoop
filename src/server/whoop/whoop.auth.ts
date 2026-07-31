import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "@/server/db";
import { redis } from "@/server/redis";
import { logger } from "@/lib/logger";

import { WhoopClient } from "./whoop.client";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 2 * 60 * 1000;

/** Escopos confirmados na doc oficial — ver WHOOP_INTEGRATION.md §1. */
export const WHOOP_SCOPES = [
  "offline",
  "read:profile",
  "read:cycles",
  "read:recovery",
  "read:sleep",
  "read:workout",
  "read:body_measurement",
] as const;

function getEncryptionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) throw new Error("TOKEN_ENCRYPTION_KEY não configurada.");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY precisa ter 32 bytes (64 chars hex).");
  return key;
}

/** AES-256-GCM — nunca loga nem retorna o token em claro fora deste módulo. */
export function encryptToken(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Payload de token criptografado malformado.");
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** `state` assinado (HMAC) contra CSRF — sem PKCE, não confirmado como exigido pela WHOOP. */
export function createSignedState(): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `${nonce}.${timestamp}`;
  const signature = createHmac("sha256", requireAuthSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySignedState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, timestamp, signature] = parts;
  if (!nonce || !timestamp || !signature) return false;

  const expected = createHmac("sha256", requireAuthSecret()).update(`${nonce}.${timestamp}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return false;
  }

  const age = Date.now() - Number(timestamp);
  return age >= 0 && age <= STATE_MAX_AGE_MS;
}

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado.");
  return secret;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("WHOOP_CLIENT_ID"),
    redirect_uri: requireEnv("WHOOP_REDIRECT_URI"),
    scope: WHOOP_SCOPES.join(" "),
    state,
  });
  return `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada — necessária para WHOOP_MODE=live.`);
  return value;
}

export async function exchangeCodeAndConnect(userId: string, code: string) {
  const tokenResponse = await WhoopClient.exchangeCode({
    code,
    redirectUri: requireEnv("WHOOP_REDIRECT_URI"),
    clientId: requireEnv("WHOOP_CLIENT_ID"),
    clientSecret: requireEnv("WHOOP_CLIENT_SECRET"),
  });

  const client = new WhoopClient(tokenResponse.access_token);
  const profile = await client.getProfile();
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

  await db.$transaction(async (tx) => {
    const connection = await tx.whoopConnection.upsert({
      where: { userId },
      create: {
        userId,
        status: "IMPORTING_HISTORY",
        whoopUserId: String(profile.user_id),
        scopesGranted: tokenResponse.scope.split(" "),
        connectedAt: new Date(),
      },
      update: {
        status: "IMPORTING_HISTORY",
        whoopUserId: String(profile.user_id),
        scopesGranted: tokenResponse.scope.split(" "),
        connectedAt: new Date(),
        disconnectedAt: null,
      },
    });

    await tx.whoopToken.upsert({
      where: { connectionId: connection.id },
      create: {
        connectionId: connection.id,
        accessTokenEnc: encryptToken(tokenResponse.access_token),
        refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
        expiresAt,
      },
      update: {
        accessTokenEnc: encryptToken(tokenResponse.access_token),
        refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
        expiresAt,
        rotatedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: { actorId: userId, action: "whoop.connected", targetType: "WhoopConnection", targetId: connection.id },
    });
  });

  logger.info("whoop.oauth.connected", { userId });
}

/**
 * Retorna um access token válido, renovando antes se estiver perto de expirar. Lock via
 * Redis evita duas requisições simultâneas disparando refresh ao mesmo tempo (o refresh
 * token da WHOOP invalida o anterior a cada uso).
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await db.whoopConnection.findUnique({ where: { userId }, include: { token: true } });
  if (!connection?.token) {
    throw new Error("Usuário sem conexão WHOOP ativa.");
  }

  const needsRefresh = connection.token.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
  if (!needsRefresh) {
    return decryptToken(connection.token.accessTokenEnc);
  }

  const lockKey = `whoop:refresh:${userId}`;
  const lockAcquired = redis ? (await redis.set(lockKey, "1", { nx: true, ex: 30 })) === "OK" : true;

  if (!lockAcquired) {
    // outra requisição já está renovando — pequena espera e reconsulta.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const refreshed = await db.whoopToken.findUnique({ where: { connectionId: connection.id } });
    if (refreshed && refreshed.expiresAt.getTime() - Date.now() >= REFRESH_SKEW_MS) {
      return decryptToken(refreshed.accessTokenEnc);
    }
  }

  try {
    const tokenResponse = await WhoopClient.refreshToken({
      refreshToken: decryptToken(connection.token.refreshTokenEnc),
      clientId: requireEnv("WHOOP_CLIENT_ID"),
      clientSecret: requireEnv("WHOOP_CLIENT_SECRET"),
    });

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    await db.whoopToken.update({
      where: { connectionId: connection.id },
      data: {
        accessTokenEnc: encryptToken(tokenResponse.access_token),
        refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
        expiresAt,
        rotatedAt: new Date(),
      },
    });

    return tokenResponse.access_token;
  } catch (error) {
    await db.whoopConnection.update({ where: { userId }, data: { status: "RECONNECT_REQUIRED" } });
    logger.warn("whoop.token_refresh_failed", { userId });
    throw error;
  } finally {
    if (redis) await redis.del(lockKey);
  }
}

export async function revokeConnection(userId: string) {
  const connection = await db.whoopConnection.findUnique({ where: { userId }, include: { token: true } });
  if (!connection) return;

  if (connection.token) {
    try {
      const accessToken = decryptToken(connection.token.accessTokenEnc);
      await new WhoopClient(accessToken).revokeAccess();
    } catch (error) {
      logger.warn("whoop.revoke_failed_continuing", { userId, message: (error as Error).message });
    }
    await db.whoopToken.delete({ where: { connectionId: connection.id } });
  }

  await db.whoopConnection.update({
    where: { userId },
    data: { status: "NOT_CONNECTED", disconnectedAt: new Date() },
  });

  await db.auditLog.create({
    data: { actorId: userId, action: "whoop.disconnected", targetType: "WhoopConnection", targetId: connection.id },
  });
}
