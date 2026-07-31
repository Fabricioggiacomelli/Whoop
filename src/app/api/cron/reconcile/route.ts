import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { runHistoricalImportBatch } from "@/server/whoop/whoop.historicalImporter";
import { syncAllResourcesForUser, syncBodyMeasurement } from "@/server/whoop/whoop.sync";

/**
 * Chamado pelo Vercel Cron (ver vercel.json) com `Authorization: Bearer <CRON_SECRET>`.
 * Cobre exatamente o que os webhooks não cobrem: `cycle` e `body_measurement` não têm
 * webhook na WHOOP (WHOOP_INTEGRATION.md §5) — só chegam por polling. Também re-sincroniza
 * recovery/sleep/workout para pegar qualquer webhook perdido fora da janela de retry.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await db.whoopConnection.findMany({
    where: { status: { in: ["UP_TO_DATE", "SYNCING", "AWAITING_DATA", "IMPORTING_HISTORY", "TEMP_ERROR"] } },
  });

  const results: Array<{ userId: string; action: string; ok?: boolean; done?: boolean; error?: string }> = [];

  for (const connection of connections) {
    try {
      if (connection.status === "IMPORTING_HISTORY") {
        const { done } = await runHistoricalImportBatch(connection.userId);
        results.push({ userId: connection.userId, action: "historical_import", done });
        continue;
      }

      await syncAllResourcesForUser(connection.userId);
      await syncBodyMeasurement(connection.userId);
      results.push({ userId: connection.userId, action: "reconcile", ok: true });
    } catch (error) {
      logger.warn("cron.reconcile.user_failed", {
        userId: connection.userId,
        message: (error as Error).message,
      });
      results.push({ userId: connection.userId, action: "reconcile", error: (error as Error).message });
    }
  }

  logger.info("cron.reconcile.completed", { processed: results.length });
  return NextResponse.json({ processed: results.length, results });
}
