import { toZonedTime } from "date-fns-tz";

import { db } from "@/server/db";
import { APP_TIMEZONE } from "@/lib/timezone";

import type { DailyMetric } from "./types";
import { dateKey } from "./timeframes";

const FINAL_STATUSES = ["CLOSED", "REPROCESSED"] as const;

function bedTimeMinutesOfDay(startedAt: Date): number {
  const zoned = toZonedTime(startedAt, APP_TIMEZONE);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Busca a série diária de métricas de um usuário num intervalo, em lote (3 queries fixas,
 * sem N+1 e sem `findUnique` concorrente — ver nota de arquitetura sobre o bug do driver
 * adapter do Prisma com chaves compostas). Só inclui dias fechados (CLOSED/REPROCESSED);
 * dias em andamento ou incompletos ficam de fora pra não distorcer estatística.
 */
export async function getDailyMetricsSeries(userId: string, from: Date, to: Date): Promise<DailyMetric[]> {
  const performances = await db.dailyPerformance.findMany({
    where: {
      userId,
      competitiveDate: { gte: from, lte: to },
      status: { in: [...FINAL_STATUSES] },
    },
    orderBy: { competitiveDate: "asc" },
  });

  if (performances.length === 0) return [];

  const cycleIds = performances.map((p) => p.cycleId).filter((id): id is string => id != null);
  const journalEntryIds = performances
    .map((p) => p.journalEntryId)
    .filter((id): id is string => id != null);

  const [cycles, journalEntries, journalAnswers] = await Promise.all([
    cycleIds.length > 0
      ? db.whoopCycle.findMany({ where: { id: { in: cycleIds } }, include: { sleeps: true, recovery: true } })
      : Promise.resolve([]),
    journalEntryIds.length > 0
      ? db.journalEntry.findMany({ where: { id: { in: journalEntryIds } } })
      : Promise.resolve([]),
    journalEntryIds.length > 0
      ? db.journalAnswer.findMany({ where: { journalEntryId: { in: journalEntryIds } }, include: { habit: true } })
      : Promise.resolve([]),
  ]);

  const cycleById = new Map(cycles.map((c) => [c.id, c]));
  const journalEntryById = new Map(journalEntries.map((j) => [j.id, j]));
  const answersByEntryId = new Map<string, Record<string, string>>();
  for (const answer of journalAnswers) {
    if (!answersByEntryId.has(answer.journalEntryId)) answersByEntryId.set(answer.journalEntryId, {});
    answersByEntryId.get(answer.journalEntryId)![answer.habit.key] = answer.value;
  }

  const series: DailyMetric[] = [];

  for (const performance of performances) {
    const cycle = performance.cycleId ? cycleById.get(performance.cycleId) : null;
    const mainSleep = cycle?.sleeps.find((s) => !s.isNap) ?? null;
    const journalEntry = performance.journalEntryId ? journalEntryById.get(performance.journalEntryId) : null;
    const habitAnswers =
      journalEntry?.status === "SUBMITTED" ? (answersByEntryId.get(journalEntry.id) ?? {}) : null;
    const strain = cycle?.strain != null ? Number(cycle.strain) : null;

    series.push({
      date: performance.competitiveDate,
      dateKey: dateKey(performance.competitiveDate),
      recoveryScore: cycle?.recovery?.recoveryScore != null ? Number(cycle.recovery.recoveryScore) : null,
      hrvMs: cycle?.recovery?.hrvMs != null ? Number(cycle.recovery.hrvMs) : null,
      restingHeartRate:
        cycle?.recovery?.restingHeartRate != null ? Number(cycle.recovery.restingHeartRate) : null,
      sleepPerformancePct: mainSleep?.sleepPerformancePct != null ? Number(mainSleep.sleepPerformancePct) : null,
      sleepEfficiencyPct: mainSleep?.sleepEfficiencyPct != null ? Number(mainSleep.sleepEfficiencyPct) : null,
      timeInBedHours: mainSleep?.timeInBedMinutes != null ? mainSleep.timeInBedMinutes / 60 : null,
      sleepDebtMinutes: mainSleep?.sleepDebtMinutes ?? null,
      disturbanceCount: mainSleep?.disturbanceCount ?? null,
      bedTimeMinutesOfDay: mainSleep?.startedAt ? bedTimeMinutesOfDay(mainSleep.startedAt) : null,
      strain,
      trained: (strain ?? 0) > 0,
      habitAnswers,
    });
  }

  return series;
}

/**
 * Filtra por intervalo de datas comparando `dateKey` (string YYYY-MM-DD), não o instante
 * do `Date`. Necessário porque `competitiveDate` (`@db.Date`) volta do banco como meia-noite
 * UTC, enquanto `from`/`to` calculados por `todayInAppTimezone()` são meia-noite de SP
 * representada em UTC (03:00Z) — comparar os instantes diretamente excluiria o próprio dia
 * de hoje do range. Ver a mesma classe de bug já corrigida em `src/lib/timezone.ts`.
 */
export function sliceByDateRange(series: DailyMetric[], from: Date, to: Date): DailyMetric[] {
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  return series.filter((d) => d.dateKey >= fromKey && d.dateKey <= toKey);
}

export function metricValues(series: DailyMetric[], key: keyof DailyMetric): number[] {
  return series
    .map((d) => d[key])
    .filter((v): v is number => typeof v === "number");
}

/** Métrica do dia seguinte a cada entrada de `series`, indexado pelo dateKey de origem — usado pra lag+1 (ex: Strain de hoje x Recovery de amanhã). */
export function nextDayValueByDateKey(
  series: DailyMetric[],
  key: keyof DailyMetric,
): Map<string, number> {
  const byDateKey = new Map(series.map((d) => [d.dateKey, d]));
  const result = new Map<string, number>();

  for (const day of series) {
    const next = new Date(day.date);
    next.setDate(next.getDate() + 1);
    const nextEntry = byDateKey.get(dateKey(next));
    const value = nextEntry?.[key];
    if (typeof value === "number") result.set(day.dateKey, value);
  }

  return result;
}
