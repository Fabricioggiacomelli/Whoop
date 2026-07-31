import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { computeDailyScore } from "@/server/scoring/engine";
import { recomputeRankingsForDate } from "@/server/services/ranking.service";
import { generateRoastForUser } from "@/server/services/roast.service";

import { getValidAccessToken } from "./whoop.auth";
import { WhoopClient } from "./whoop.client";
import {
  isScored,
  normalizeBodyMeasurement,
  normalizeCycle,
  normalizeRecovery,
  normalizeSleep,
  normalizeWorkout,
} from "./whoop.normalizer";
import type { WhoopCycleRaw, WhoopRecoveryRaw, WhoopSleepRaw, WhoopWorkoutRaw } from "./whoop.types";

/** Ciclo pertence ao dia em que ele TERMINA (a manhã em que o usuário acorda). */
function competitiveDateForCycle(startedAt: Date): Date {
  const date = new Date(startedAt);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function recordRawEvent(userId: string, resource: string, payload: unknown, source: "SYNC" | "HISTORICAL" = "SYNC") {
  await db.whoopRawEvent.create({ data: { userId, resource, source, payload: payload as never } });
}

export async function upsertCycle(userId: string, raw: WhoopCycleRaw, source?: "SYNC" | "HISTORICAL") {
  const data = normalizeCycle(raw);
  await db.whoopCycle.upsert({
    where: { externalId: data.externalId },
    create: { ...data, userId },
    update: data,
  });
  await recordRawEvent(userId, "cycle", raw, source);
}

export async function upsertSleep(userId: string, raw: WhoopSleepRaw, source?: "SYNC" | "HISTORICAL") {
  const data = normalizeSleep(raw);
  const cycle = raw.cycle_id
    ? await db.whoopCycle.findUnique({ where: { externalId: String(raw.cycle_id) } })
    : null;
  await db.whoopSleep.upsert({
    where: { externalId: data.externalId },
    create: { ...data, userId, cycleId: cycle?.id },
    update: { ...data, cycleId: cycle?.id },
  });
  await recordRawEvent(userId, "sleep", raw, source);
}

export async function upsertRecovery(userId: string, raw: WhoopRecoveryRaw, source?: "SYNC" | "HISTORICAL") {
  const cycle = await db.whoopCycle.findUnique({ where: { externalId: String(raw.cycle_id) } });
  if (!cycle) {
    logger.warn("whoop.sync.recovery_without_cycle", { userId, cycleId: raw.cycle_id });
    return;
  }
  const data = normalizeRecovery(raw);
  await db.whoopRecovery.upsert({
    where: { externalId: data.externalId },
    create: { ...data, userId, cycleId: cycle.id },
    update: data,
  });
  await recordRawEvent(userId, "recovery", raw, source);
}

export async function upsertWorkout(userId: string, raw: WhoopWorkoutRaw, source?: "SYNC" | "HISTORICAL") {
  const data = normalizeWorkout(raw);
  await db.whoopWorkout.upsert({
    where: { externalId: data.externalId },
    create: { ...data, userId },
    update: data,
  });
  await recordRawEvent(userId, "workout", raw, source);
}

export async function syncBodyMeasurement(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  const client = new WhoopClient(accessToken);
  const raw = await client.getBodyMeasurement();
  const data = normalizeBodyMeasurement(userId, raw);

  await db.whoopBodyMeasurement.upsert({
    where: { externalId: data.externalId },
    create: { ...data, userId },
    update: data,
  });
  await recordRawEvent(userId, "body_measurement", raw);
}

/**
 * Sincroniza a página mais recente de cada recurso (usado após um webhook pontual ou pela
 * reconciliação) — não pagina o histórico inteiro, isso é o `WhoopHistoricalImporter`.
 */
export async function syncAllResourcesForUser(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  const client = new WhoopClient(accessToken);

  const [cyclesPage, recoveriesPage, sleepsPage, workoutsPage] = await Promise.all([
    client.getCycles(),
    client.getRecoveries(),
    client.getSleeps(),
    client.getWorkouts(),
  ]);

  for (const raw of cyclesPage.records) await upsertCycle(userId, raw);
  for (const raw of sleepsPage.records) await upsertSleep(userId, raw);
  for (const raw of recoveriesPage.records) await upsertRecovery(userId, raw);
  for (const raw of workoutsPage.records) await upsertWorkout(userId, raw);

  await db.whoopConnection.update({
    where: { userId },
    data: { status: "UP_TO_DATE", lastSyncedAt: new Date() },
  });

  for (const raw of cyclesPage.records) {
    await closeDayIfReady(userId, String(raw.id));
  }

  logger.info("whoop.sync.completed", {
    userId,
    cycles: cyclesPage.records.length,
    recoveries: recoveriesPage.records.length,
    sleeps: sleepsPage.records.length,
    workouts: workoutsPage.records.length,
  });
}

/**
 * Fecha o dia competitivo quando sono e Recovery do ciclo estão presentes e `score_state`
 * (guardado em `raw`) indica "SCORED" — nunca pela mera presença do registro. Ver
 * WHOOP_INTEGRATION.md §6.
 */
export async function closeDayIfReady(userId: string, cycleExternalId: string) {
  const cycle = await db.whoopCycle.findUnique({
    where: { externalId: cycleExternalId },
    include: { sleep: true, recovery: true },
  });
  if (!cycle) return;

  const sleepScoreState = (cycle.sleep?.raw as { score_state?: string } | null)?.score_state;
  const recoveryScoreState = (cycle.recovery?.raw as { score_state?: string } | null)?.score_state;
  const sleepScored = Boolean(sleepScoreState && isScored(sleepScoreState));
  const recoveryScored = Boolean(recoveryScoreState && isScored(recoveryScoreState));

  const competitiveDate = competitiveDateForCycle(cycle.startedAt);

  const status = !cycle.sleep
    ? "AWAITING_SLEEP"
    : !sleepScored
      ? "AWAITING_SLEEP"
      : !cycle.recovery
        ? "AWAITING_RECOVERY"
        : !recoveryScored
          ? "AWAITING_RECOVERY"
          : "CLOSED";

  const performance = await db.dailyPerformance.upsert({
    where: { userId_competitiveDate: { userId, competitiveDate } },
    create: { userId, competitiveDate, cycleId: cycle.id, status, closedAt: status === "CLOSED" ? new Date() : null },
    update: { cycleId: cycle.id, status, closedAt: status === "CLOSED" ? new Date() : undefined },
  });

  if (status !== "CLOSED") return;

  await computeDailyScore({ userId, competitiveDate });
  await recomputeRankingsForDate(competitiveDate);
  await generateRoastForUser(userId, competitiveDate);

  logger.info("whoop.day_closed", { userId, competitiveDate, dailyPerformanceId: performance.id });
}
