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
    const snapshot = await db.rankingSnapshot.findUnique({
      where: { scope_periodKey_userId: { scope: "DAILY", periodKey, userId } },
    });

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
      position: snapshot?.position ?? null,
    });
  }

  return points;
}
