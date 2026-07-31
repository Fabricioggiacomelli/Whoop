import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { whoopWebhookRateLimiter } from "@/lib/rate-limit";
import { handleWebhookEvent, verifyWebhookSignature } from "@/server/whoop/whoop.webhook";
import type { WhoopWebhookPayload } from "@/server/whoop/whoop.types";

/**
 * Endpoint público (sem sessão APEX 4 — autenticado só pela assinatura HMAC da WHOOP).
 * Processa inline em vez de enfileirar de verdade: com 4 usuários o volume é baixo o
 * suficiente para ficar bem dentro da janela de retry da WHOOP (5x em ~1h); se a escala
 * crescer, trocar por uma fila real (Upstash QStash) sem mudar `whoop.webhook.ts`.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-WHOOP-Signature") ?? "";
  const timestamp = request.headers.get("X-WHOOP-Signature-Timestamp") ?? "";

  const { success } = await whoopWebhookRateLimiter.limit("whoop-webhook-global");
  if (!success) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  if (!verifyWebhookSignature(rawBody, timestamp, signature)) {
    logger.warn("whoop.webhook.invalid_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: WhoopWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhoopWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  await handleWebhookEvent(payload);

  return NextResponse.json({ ok: true });
}
