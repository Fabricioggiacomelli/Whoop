import { db } from "@/server/db";
import { logger } from "@/lib/logger";

import { getValidAccessToken } from "./whoop.auth";
import { WhoopClient, type PageParams } from "./whoop.client";
import { upsertCycle, upsertRecovery, upsertSleep, upsertWorkout, closeDayIfReady } from "./whoop.sync";
import type { WhoopPaginated } from "./whoop.types";

const MAX_PAGES_PER_INVOCATION = 20;

type ResourceName = "cycle" | "recovery" | "sleep" | "workout";

async function importResource<T>(
  userId: string,
  resource: ResourceName,
  fetchPage: (params: PageParams) => Promise<WhoopPaginated<T>>,
  persist: (raw: T) => Promise<void>,
): Promise<{ done: boolean; imported: number }> {
  const existingCursor = await db.whoopSyncCursor.findUnique({
    where: { userId_resource: { userId, resource } },
  });

  let nextToken = existingCursor?.cursor ?? undefined;
  let imported = 0;

  for (let page = 0; page < MAX_PAGES_PER_INVOCATION; page++) {
    const result = await fetchPage({ limit: 25, nextToken: nextToken ?? undefined });

    for (const record of result.records) {
      await persist(record);
      imported += 1;
    }

    nextToken = result.next_token ?? undefined;

    await db.whoopSyncCursor.upsert({
      where: { userId_resource: { userId, resource } },
      create: { userId, resource, cursor: nextToken ?? null, lastCompletedAt: nextToken ? undefined : new Date() },
      update: { cursor: nextToken ?? null, lastCompletedAt: nextToken ? undefined : new Date() },
    });

    if (!nextToken) {
      return { done: true, imported };
    }
  }

  // Ainda há mais páginas — uma próxima invocação (ver WHOOP_INTEGRATION.md §4) retoma do
  // cursor salvo. Compatível com o limite de duração de function do Vercel.
  return { done: false, imported };
}

/**
 * Importa o histórico disponível, um lote por invocação. `WhoopConnection.status` fica
 * `IMPORTING_HISTORY` enquanto qualquer recurso ainda não terminou.
 */
export async function runHistoricalImportBatch(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  const client = new WhoopClient(accessToken);

  const job = await db.whoopSyncJob.create({
    data: { userId, type: "HISTORICAL_IMPORT", status: "RUNNING", startedAt: new Date() },
  });

  try {
    const cycles = await importResource(userId, "cycle", (p) => client.getCycles(p), (raw) =>
      upsertCycle(userId, raw, "HISTORICAL"),
    );
    const sleeps = await importResource(userId, "sleep", (p) => client.getSleeps(p), (raw) =>
      upsertSleep(userId, raw, "HISTORICAL"),
    );
    const recoveries = await importResource(userId, "recovery", (p) => client.getRecoveries(p), (raw) =>
      upsertRecovery(userId, raw, "HISTORICAL"),
    );
    const workouts = await importResource(userId, "workout", (p) => client.getWorkouts(p), (raw) =>
      upsertWorkout(userId, raw, "HISTORICAL"),
    );

    const allDone = cycles.done && sleeps.done && recoveries.done && workouts.done;

    await db.whoopSyncJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    });

    if (allDone) {
      const allCycles = await db.whoopCycle.findMany({ where: { userId }, select: { externalId: true } });
      for (const { externalId } of allCycles) {
        await closeDayIfReady(userId, externalId);
      }

      await db.whoopConnection.update({
        where: { userId },
        data: { status: "UP_TO_DATE", lastSyncedAt: new Date() },
      });
    }

    logger.info("whoop.historical_import.batch", {
      userId,
      allDone,
      counts: {
        cycles: cycles.imported,
        sleeps: sleeps.imported,
        recoveries: recoveries.imported,
        workouts: workouts.imported,
      },
    });

    return { done: allDone };
  } catch (error) {
    await db.whoopSyncJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: (error as Error).message, finishedAt: new Date() },
    });
    await db.whoopConnection.update({ where: { userId }, data: { status: "TEMP_ERROR" } });
    logger.warn("whoop.historical_import.failed", { userId, message: (error as Error).message });
    throw error;
  }
}
