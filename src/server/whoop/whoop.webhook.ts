import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@/server/db";
import { logger } from "@/lib/logger";

import { getValidAccessToken } from "./whoop.auth";
import { WhoopClient } from "./whoop.client";
import { closeDayIfReady, upsertRecovery, upsertSleep, upsertWorkout } from "./whoop.sync";
import type { WhoopWebhookPayload } from "./whoop.types";

/**
 * Verificação confirmada na doc oficial: base64(HMAC-SHA256(timestamp + rawBody, secret)).
 * A WHOOP assina com o **Client Secret** do app (o mesmo do OAuth) — não existe um segredo
 * de webhook separado para configurar no dashboard (a tela de Webhooks só pede a URL).
 * Precisa do corpo BRUTO da requisição — nunca do objeto já parseado (reserializar um JSON
 * pode mudar espaçamento/ordem de chaves e quebrar a assinatura). Ver WHOOP_INTEGRATION.md §5.
 */
export function verifyWebhookSignature(rawBody: string, timestampHeader: string, signatureHeader: string): boolean {
  const secret = process.env.WHOOP_CLIENT_SECRET;
  if (!secret || !timestampHeader || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(timestampHeader + rawBody).digest("base64");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Idempotente por `trace_id`. Nunca usa os dados do payload como fato — sempre rebusca o
 * recurso completo via `WhoopClient` antes de normalizar/persistir (WHOOP_INTEGRATION.md §5).
 */
export async function handleWebhookEvent(payload: WhoopWebhookPayload) {
  const existing = await db.whoopWebhookEvent.findUnique({ where: { externalEventId: payload.trace_id } });
  if (existing) {
    logger.info("whoop.webhook.duplicate_ignored", { traceId: payload.trace_id });
    return;
  }

  await db.whoopWebhookEvent.create({
    data: {
      externalEventId: payload.trace_id,
      type: payload.type,
      payload: payload as never,
      status: "RECEIVED",
    },
  });

  const connection = await db.whoopConnection.findUnique({ where: { whoopUserId: String(payload.user_id) } });
  if (!connection) {
    await db.whoopWebhookEvent.update({
      where: { externalEventId: payload.trace_id },
      data: { status: "IGNORED", processedAt: new Date() },
    });
    logger.warn("whoop.webhook.unknown_user", { whoopUserId: payload.user_id });
    return;
  }

  try {
    const accessToken = await getValidAccessToken(connection.userId);
    const client = new WhoopClient(accessToken);
    const userId = connection.userId;

    let affectedCycleExternalId: string | null = null;

    if (payload.type === "sleep.updated") {
      const sleep = await client.getSleepById(String(payload.id));
      await upsertSleep(userId, sleep);
      if (sleep.cycle_id) affectedCycleExternalId = String(sleep.cycle_id);
    } else if (payload.type === "workout.updated") {
      const workout = await client.getWorkoutById(String(payload.id));
      await upsertWorkout(userId, workout);
    } else if (payload.type === "recovery.updated") {
      // `payload.id` é o UUID do sleep (confirmado na doc) — buscamos o sleep para achar o
      // cycle_id e então a recovery daquele ciclo.
      const sleep = await client.getSleepById(String(payload.id));
      if (sleep.cycle_id) {
        const recovery = await client.getRecoveryForCycle(sleep.cycle_id);
        await upsertRecovery(userId, recovery);
        affectedCycleExternalId = String(sleep.cycle_id);
      }
    }
    // *.deleted não removemos dados automaticamente no MVP — fica registrado no
    // WhoopWebhookEvent para auditoria/reprocessamento manual futuro.

    if (affectedCycleExternalId) {
      await closeDayIfReady(userId, affectedCycleExternalId);
    }

    await db.whoopWebhookEvent.update({
      where: { externalEventId: payload.trace_id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (error) {
    await db.whoopWebhookEvent.update({
      where: { externalEventId: payload.trace_id },
      data: { status: "FAILED", error: (error as Error).message, processedAt: new Date() },
    });
    logger.warn("whoop.webhook.processing_failed", { traceId: payload.trace_id, message: (error as Error).message });
    // Não relança: a WHOOP reentrega 5x em ~1h por status != 2xx; se persistir, o cron de
    // reconciliação cobre o gap. Falhar o processo do webhook não deve derrubar a resposta.
  }
}
