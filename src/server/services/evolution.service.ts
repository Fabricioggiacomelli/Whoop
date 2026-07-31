import { db } from "@/server/db";
import { dailyPeriodKey } from "@/server/services/ranking.service";

export type EvolutionPoint = {
  date: string;
  score: number | null;
  recovery: number | null;
  hrvRelative: number | null;
  restingHr: number | null;
  sleep: number | null;
  strain: number | null;
  consistency: number | null;
  habits: number | null;
  position: number | null;
};

export async function getEvolutionSeries(userId: string, windowDays: number | null): Promise<EvolutionPoint[]> {
  const where: { userId: string; competitiveDate?: { gte: Date } } = { userId };

  if (windowDays != null) {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    where.competitiveDate = { gte: since };
  }

  const scores = await db.dailyScore.findMany({
    where,
    orderBy: { competitiveDate: "asc" },
    include: { components: true },
  });

  // Uma única consulta para os snapshots de posição de todos os dias, em vez de uma
  // sequencial por dia (até centenas de round-trips em "Desde o início").
  const periodKeys = scores.map((score) => dailyPeriodKey(score.competitiveDate));
  const snapshots = await db.rankingSnapshot.findMany({
    where: { scope: "DAILY", periodKey: { in: periodKeys }, userId },
  });
  const positionByPeriodKey = new Map(snapshots.map((s) => [s.periodKey, s.position]));

  const points: EvolutionPoint[] = [];

  for (const score of scores) {
    const recoveryComp = score.components.find((c) => c.category === "RECOVERY");
    const sleepComp = score.components.find((c) => c.category === "SLEEP");
    const strainComp = score.components.find((c) => c.category === "STRAIN");
    const consistencyComp = score.components.find((c) => c.category === "CONSISTENCY");
    const habitsComp = score.components.find((c) => c.category === "HABITS");

    const recoveryInput = recoveryComp?.inputValue as
      | { recoveryScore?: number; hrvMs?: number; restingHeartRate?: number }
      | null;
    const recoveryBaseline = recoveryComp?.baselineComparison as { baselineAvgHrvMs?: number | null } | null;
    const sleepInput = sleepComp?.inputValue as { sleepPerformancePct?: number } | null;
    const strainInput = strainComp?.inputValue as { strain?: number; trained?: boolean } | null;

    const periodKey = dailyPeriodKey(score.competitiveDate);

    points.push({
      date: periodKey,
      score: Number(score.totalPoints),
      recovery: recoveryInput?.recoveryScore ?? null,
      hrvRelative:
        recoveryInput?.hrvMs && recoveryBaseline?.baselineAvgHrvMs
          ? Math.round((recoveryInput.hrvMs / recoveryBaseline.baselineAvgHrvMs) * 100)
          : null,
      restingHr: recoveryInput?.restingHeartRate ?? null,
      sleep: sleepInput?.sleepPerformancePct ?? null,
      strain: strainInput?.trained ? (strainInput.strain ?? null) : 0,
      consistency: consistencyComp ? Number(consistencyComp.pointsEarned) : null,
      habits: habitsComp ? Number(habitsComp.pointsEarned) : null,
      position: positionByPeriodKey.get(periodKey) ?? null,
    });
  }

  return points;
}
