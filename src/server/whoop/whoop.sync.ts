import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { calendarDateInAppTimezone } from "@/lib/timezone";
import { computeDailyScore } from "@/server/scoring/engine";
import { recomputeRankingsForDate } from "@/server/services/ranking.service";
import { generateRoastForUser } from "@/server/services/roast.service";

import { mapWithConcurrency } from "./concurrency";
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

/**
 * Dia competitivo = a data (meia-noite no fuso do app) do horário em que o usuário ACORDOU
 * (fim do sono principal) — nunca "início do ciclo + 1 dia": um ciclo dura da hora de
 * dormir até a PRÓXIMA hora de dormir (~24h), então "início + 1 dia" cai perto da próxima
 * noite, não da manhã seguinte. Isso rotulava sistematicamente todo dia fechado com a data
 * de amanhã (ex: acordar às 11h de terça virava "quarta-feira" no app).
 */
function competitiveDateForWakeUp(wokeUpAt: Date): Date {
  return calendarDateInAppTimezone(wokeUpAt);
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

  const CONCURRENCY = 3;
  await mapWithConcurrency(cyclesPage.records, CONCURRENCY, (raw) => upsertCycle(userId, raw));
  await mapWithConcurrency(sleepsPage.records, CONCURRENCY, (raw) => upsertSleep(userId, raw));
  await mapWithConcurrency(recoveriesPage.records, CONCURRENCY, (raw) => upsertRecovery(userId, raw));
  await mapWithConcurrency(workoutsPage.records, CONCURRENCY, (raw) => upsertWorkout(userId, raw));

  await db.whoopConnection.update({
    where: { userId },
    data: { status: "UP_TO_DATE", lastSyncedAt: new Date() },
  });

  await mapWithConcurrency(cyclesPage.records, CONCURRENCY, (raw) => closeDayIfReady(userId, String(raw.id)));

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
    include: { sleeps: true, recovery: true },
  });
  if (!cycle) return;

  // Um ciclo pode ter mais de um registro de sono (soneca + sono principal) — só o sono
  // principal (isNap: false) conta para o fechamento do dia competitivo.
  const mainSleep = cycle.sleeps.find((s) => !s.isNap) ?? null;

  const sleepScoreState = (mainSleep?.raw as { score_state?: string } | null)?.score_state;
  const sleepScored = Boolean(sleepScoreState && isScored(sleepScoreState));

  // Sem o sono principal (ou ainda não SCORED) não dá pra saber com segurança a qual dia
  // calendário este ciclo pertence — nunca grava um placeholder por "início do ciclo" aqui.
  // Quem dorme antes da meia-noite (a maioria) tem o ciclo de HOJE fechando (rotulado pelo
  // horário em que acordou hoje) bem na hora em que o ciclo de AMANHÃ começa (foi dormir de
  // novo) — os dois caem no mesmo dia calendário até virar meia-noite, e um placeholder
  // baseado no início desse novo ciclo colidiria com a chave (userId, dia) do dia que
  // acabou de fechar de verdade, sobrescrevendo-o de volta para um estado não-final.
  if (!mainSleep || !sleepScored) return;

  const competitiveDate = competitiveDateForWakeUp(mainSleep.endedAt);

  const recoveryScoreState = (cycle.recovery?.raw as { score_state?: string } | null)?.score_state;
  const recoveryScored = Boolean(recoveryScoreState && isScored(recoveryScoreState));

  // A WHOOP anexa o sono/recovery da noite ao ciclo que ACABOU DE COMEÇAR (não ao que
  // terminou) — então o ciclo do dia corrente já aparece com sono+recovery "SCORED" horas
  // depois de acordar, mesmo com o strain do dia ainda subindo. Sem checar `endedAt`, o dia
  // fechava (e pontuava) usando um strain provisório, rotulado com a data de amanhã.
  const status = !cycle.endedAt
    ? "IN_PROGRESS"
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
