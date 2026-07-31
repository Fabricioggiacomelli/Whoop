import { db } from "@/server/db";

import { round } from "./helpers";
import type { Baseline } from "./types";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, v) => sum + v, 0) / values.length, 2);
}

/**
 * Calcula a linha de base do usuário numa janela móvel terminando (exclusive) em `asOfDate`
 * — nunca olha para o futuro. Usado tanto pela engine (comparação do dia) quanto para
 * persistir um snapshot auditável em `UserBaseline` (ver DATABASE.md §3).
 *
 * Aproximação aceita: o filtro por `startedAt` do ciclo (que começa ~22h da noite anterior)
 * é usado como proxy do dia competitivo — suficiente para uma janela de médio prazo, não
 * precisa de precisão de minuto.
 */
export async function computeBaseline(
  userId: string,
  asOfDate: Date,
  windowDays = 28,
): Promise<Baseline> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const cycles = await db.whoopCycle.findMany({
    where: { userId, startedAt: { gte: windowStart, lt: asOfDate } },
    select: { strain: true, startedAt: true },
    orderBy: { startedAt: "asc" },
  });

  const sleeps = await db.whoopSleep.findMany({
    where: { userId, startedAt: { gte: windowStart, lt: asOfDate } },
    select: { sleepPerformancePct: true },
  });

  const recoveries = await db.whoopRecovery.findMany({
    where: { userId, cycle: { startedAt: { gte: windowStart, lt: asOfDate } } },
    select: { recoveryScore: true, hrvMs: true, restingHeartRate: true },
  });

  const sevenDaysAgo = new Date(asOfDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const strains = cycles.map((c) => Number(c.strain ?? 0));
  const strainsLast7 = cycles
    .filter((c) => c.startedAt >= sevenDaysAgo)
    .map((c) => Number(c.strain ?? 0));
  const trainingDayStrains = strains.filter((s) => s > 0);

  const baseline: Baseline = {
    windowDays,
    sampleDays: cycles.length,
    avgSleepPerfPct: average(sleeps.map((s) => Number(s.sleepPerformancePct)).filter(Number.isFinite)),
    avgHrvMs: average(recoveries.map((r) => Number(r.hrvMs)).filter(Number.isFinite)),
    avgRestingHr: average(
      recoveries.map((r) => Number(r.restingHeartRate)).filter(Number.isFinite),
    ),
    avgRecoveryScore: average(
      recoveries.map((r) => Number(r.recoveryScore)).filter(Number.isFinite),
    ),
    avgStrain: average(strains),
    avgTrainingDayStrain: average(trainingDayStrains),
    acuteLoad7d: average(strainsLast7),
    chronicLoad28d: average(strains),
  };

  return baseline;
}

export async function persistBaselineSnapshot(userId: string, baseline: Baseline) {
  return db.userBaseline.create({
    data: {
      userId,
      windowDays: baseline.windowDays,
      avgSleepPerfPct: baseline.avgSleepPerfPct,
      avgHrvMs: baseline.avgHrvMs,
      avgRestingHr: baseline.avgRestingHr,
      avgRecoveryScore: baseline.avgRecoveryScore,
      avgStrain: baseline.avgStrain,
      acuteLoad7d: baseline.acuteLoad7d,
      chronicLoad28d: baseline.chronicLoad28d,
      metadata: { sampleDays: baseline.sampleDays, avgTrainingDayStrain: baseline.avgTrainingDayStrain },
    },
  });
}
