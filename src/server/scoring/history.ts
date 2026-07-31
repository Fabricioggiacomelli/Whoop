import { db } from "@/server/db";

import { clamp, round } from "./helpers";
import type { HistoryContext } from "./types";

/** Sequência de dias consecutivos com o dia fechado (CLOSED/REPROCESSED), terminando ontem. */
async function computeConsecutiveStreak(userId: string, asOfDate: Date): Promise<number> {
  const cursor = new Date(asOfDate);
  let streak = 0;

  // Limite de 400 dias evita loop infinito; nenhuma sequência real chegará perto disso.
  for (let i = 0; i < 400; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const day = await db.dailyPerformance.findUnique({
      where: { userId_competitiveDate: { userId, competitiveDate: cursor } },
      select: { status: true },
    });
    if (!day || (day.status !== "CLOSED" && day.status !== "REPROCESSED")) break;
    streak += 1;
  }

  return streak;
}

/**
 * Quantos dos últimos 7 dias excederam a faixa recomendada. Usa a baseline estável (28d,
 * já calculada por `baseline.ts`) como referência — **nunca** a média da própria janela de
 * 7 dias: qualquer série com variação natural tem ~metade dos valores acima da própria
 * média, o que dispararia a penalidade quase sempre, para qualquer atleta. O multiplicador
 * 1.15 replica o mesmo usado em `strain.scorer.ts` (computeStrainRecommendation).
 */
async function computeStrainOverageDaysInLast7(
  userId: string,
  asOfDate: Date,
  referenceAvgStrain: number | null,
): Promise<number> {
  if (!referenceAvgStrain || referenceAvgStrain <= 0) return 0;

  const sevenDaysAgo = new Date(asOfDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const cycles = await db.whoopCycle.findMany({
    where: { userId, startedAt: { gte: sevenDaysAgo, lt: asOfDate } },
    select: { strain: true },
  });

  const impliedMax = referenceAvgStrain * 1.15;

  return cycles.filter((c) => Number(c.strain ?? 0) > impliedMax).length;
}

/** 0 (muito irregular) a 1 (muito regular) — desvio do horário de dormir nos últimos 14 dias. */
async function computeBedtimeConsistency(userId: string, asOfDate: Date): Promise<number> {
  const windowStart = new Date(asOfDate);
  windowStart.setDate(windowStart.getDate() - 14);

  const sleeps = await db.whoopSleep.findMany({
    where: { userId, startedAt: { gte: windowStart, lt: asOfDate } },
    select: { startedAt: true },
  });

  if (sleeps.length < 3) return 0.5; // histórico insuficiente — nem premia nem penaliza

  const minutesOfDay = sleeps.map((s) => {
    const h = s.startedAt.getHours();
    const m = s.startedAt.getMinutes();
    // Normaliza para uma janela contínua em torno da noite (deslocando horas da manhã +24h)
    // já que "dormir 23h" e "dormir 00h30" são próximos, não opostos, numa reta de 0-1440.
    const total = h * 60 + m;
    return total < 12 * 60 ? total + 24 * 60 : total;
  });

  const mean = minutesOfDay.reduce((s, v) => s + v, 0) / minutesOfDay.length;
  const variance = minutesOfDay.reduce((s, v) => s + (v - mean) ** 2, 0) / minutesOfDay.length;
  const stdDevMinutes = Math.sqrt(variance);

  // 0 min de desvio -> 1.0 (perfeito); 120+ min de desvio -> 0.0
  return round(clamp(1 - stdDevMinutes / 120, 0, 1), 2);
}

export async function computeHistoryContext(
  userId: string,
  asOfDate: Date,
  referenceAvgStrain: number | null,
): Promise<HistoryContext> {
  const [consecutiveDaysWithData, strainOverageDaysInLast7, bedtimeConsistency] = await Promise.all([
    computeConsecutiveStreak(userId, asOfDate),
    computeStrainOverageDaysInLast7(userId, asOfDate, referenceAvgStrain),
    computeBedtimeConsistency(userId, asOfDate),
  ]);

  return { consecutiveDaysWithData, strainOverageDaysInLast7, bedtimeConsistency };
}
