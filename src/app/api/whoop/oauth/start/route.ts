import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { buildAuthorizeUrl, createSignedState } from "@/server/whoop/whoop.auth";
import { whoopWebhookRateLimiter } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const WHOOP_STATE_COOKIE = "whoop_oauth_state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { success } = await whoopWebhookRateLimiter.limit(`whoop-oauth-start:${session.user.id}`);
  if (!success) {
    return NextResponse.json({ error: "Muitas tentativas — tente novamente em instantes." }, { status: 429 });
  }

  if ((process.env.WHOOP_MODE ?? "mock") !== "live") {
    logger.warn("whoop.oauth.start_in_mock_mode", { userId: session.user.id });
    return NextResponse.redirect(new URL("/perfil?whoop_error=mock_mode", request.url));
  }

  try {
    const state = createSignedState();
    const authorizeUrl = buildAuthorizeUrl(state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(WHOOP_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    logger.warn("whoop.oauth.start_failed", { message: (error as Error).message });
    return NextResponse.redirect(new URL("/perfil?whoop_error=config", request.url));
  }
}
