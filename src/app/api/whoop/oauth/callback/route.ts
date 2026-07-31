import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { logger } from "@/lib/logger";
import { whoopWebhookRateLimiter } from "@/lib/rate-limit";
import { exchangeCodeAndConnect, verifySignedState } from "@/server/whoop/whoop.auth";
import { runHistoricalImportBatch } from "@/server/whoop/whoop.historicalImporter";

import { WHOOP_STATE_COOKIE } from "../start/route";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { success } = await whoopWebhookRateLimiter.limit(`whoop-oauth-callback:${session.user.id}`);
  if (!success) {
    return NextResponse.json({ error: "Muitas tentativas — tente novamente em instantes." }, { status: 429 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${WHOOP_STATE_COOKIE}=`))
    ?.split("=")[1];

  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.cookies.delete(WHOOP_STATE_COOKIE);
    return response;
  };

  if (!code || !state || !cookieState || state !== cookieState || !verifySignedState(state)) {
    logger.warn("whoop.oauth.callback_invalid_state", { userId: session.user.id });
    return redirect("/perfil?whoop_error=invalid_state");
  }

  try {
    await exchangeCodeAndConnect(session.user.id, code);
    // Primeiro lote roda inline (poucos dias, rápido); lotes seguintes ficam para o cron de
    // reconciliação continuar caso o histórico seja grande — ver WHOOP_INTEGRATION.md §4.
    await runHistoricalImportBatch(session.user.id);
    return redirect("/perfil?whoop_connected=1");
  } catch (error) {
    logger.warn("whoop.oauth.callback_failed", { userId: session.user.id, message: (error as Error).message });
    return redirect("/perfil?whoop_error=exchange_failed");
  }
}
