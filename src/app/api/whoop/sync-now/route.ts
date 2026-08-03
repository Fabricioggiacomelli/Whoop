import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { logger } from "@/lib/logger";
import { whoopManualSyncRateLimiter } from "@/lib/rate-limit";
import { db } from "@/server/db";
import { syncAllResourcesForUser, syncBodyMeasurement } from "@/server/whoop/whoop.sync";

/** Chamado pelo gesto de "puxar para atualizar" — sincroniza o usuário atual sob demanda. */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { success } = await whoopManualSyncRateLimiter.limit(`whoop-sync-now:${session.user.id}`);
  if (!success) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const connection = await db.whoopConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection || connection.status === "NOT_CONNECTED") {
    return NextResponse.json({ ok: true, synced: false });
  }

  try {
    await syncAllResourcesForUser(session.user.id);
    await syncBodyMeasurement(session.user.id);
    return NextResponse.json({ ok: true, synced: true });
  } catch (error) {
    logger.warn("whoop.manual_sync_failed", { userId: session.user.id, message: (error as Error).message });
    // O puxar-para-atualizar ainda deve mostrar os dados já salvos — nunca quebrar a UI.
    return NextResponse.json({ ok: true, synced: false });
  }
}
