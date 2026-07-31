import { db } from "@/server/db";
import { dailyPeriodKey, weeklyPeriodKey } from "@/server/services/ranking.service";
import { getLatestRoast } from "@/server/services/roast.service";

export type HomeSummary = {
  latestScore: {
    competitiveDate: Date;
    totalPoints: number;
    position: number | null;
    totalAthletes: number;
    pointsBehindLeader: number | null;
    recoveryScore: number | null;
    sleepPerformancePct: number | null;
    strain: number | null;
    trained: boolean;
    strainMin: number | null;
    strainMax: number | null;
    overtrainingRisk: boolean;
    streak: number;
  } | null;
  weeklyPoints: number | null;
  weeklyPosition: number | null;
  roastText: string | null;
  recentAchievements: Array<{ key: string; name: string; icon: string; earnedAt: Date }>;
  journalPendingToday: boolean;
};

function todayLocalMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHomeSummary(userId: string): Promise<HomeSummary> {
  const latest = await db.dailyScore.findFirst({
    where: { userId },
    orderBy: { competitiveDate: "desc" },
    include: { components: true },
  });

  let latestScoreSummary: HomeSummary["latestScore"] = null;
  let weeklyPoints: number | null = null;
  let weeklyPosition: number | null = null;

  if (latest) {
    const periodKey = dailyPeriodKey(latest.competitiveDate);
    const snapshots = await db.rankingSnapshot.findMany({
      where: { scope: "DAILY", periodKey },
      orderBy: { position: "asc" },
    });
    const mine = snapshots.find((s) => s.userId === userId);
    const leader = snapshots[0];

    const sleepComp = latest.components.find((c) => c.category === "SLEEP");
    const recoveryComp = latest.components.find((c) => c.category === "RECOVERY");
    const strainComp = latest.components.find((c) => c.category === "STRAIN");
    const consistencyComp = latest.components.find((c) => c.category === "CONSISTENCY");

    const strainRec = await db.strainRecommendation.findUnique({
      where: { userId_competitiveDate: { userId, competitiveDate: latest.competitiveDate } },
    });

    const recoveryInput = recoveryComp?.inputValue as { recoveryScore?: number } | null;
    const sleepInput = sleepComp?.inputValue as { sleepPerformancePct?: number } | null;
    const strainInput = strainComp?.inputValue as { strain?: number; trained?: boolean } | null;
    const streak =
      (consistencyComp?.baselineComparison as { consecutiveDaysWithData?: number } | null)
        ?.consecutiveDaysWithData ?? 0;

    latestScoreSummary = {
      competitiveDate: latest.competitiveDate,
      totalPoints: Number(latest.totalPoints),
      position: mine?.position ?? null,
      totalAthletes: snapshots.length,
      pointsBehindLeader:
        mine && leader && mine.userId !== leader.userId ? Number(leader.points) - Number(mine.points) : null,
      recoveryScore: recoveryInput?.recoveryScore ?? null,
      sleepPerformancePct: sleepInput?.sleepPerformancePct ?? null,
      strain: strainInput?.strain ?? null,
      trained: strainInput?.trained ?? false,
      strainMin: strainRec ? Number(strainRec.min) : null,
      strainMax: strainRec ? Number(strainRec.max) : null,
      overtrainingRisk: Boolean(
        strainInput?.trained && strainRec && (strainInput.strain ?? 0) > Number(strainRec.max),
      ),
      streak,
    };

    const weeklyKey = weeklyPeriodKey(latest.competitiveDate);
    const weekly = await db.rankingSnapshot.findUnique({
      where: { scope_periodKey_userId: { scope: "WEEKLY", periodKey: weeklyKey, userId } },
    });
    weeklyPoints = weekly ? Number(weekly.points) : null;
    weeklyPosition = weekly?.position ?? null;
  }

  const roast = await getLatestRoast(userId);

  const recentAchievements = await db.userAchievement.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    take: 3,
    include: { achievement: true },
  });

  const todayJournal = await db.journalEntry.findUnique({
    where: { userId_referenceDate: { userId, referenceDate: todayLocalMidnight() } },
  });

  return {
    latestScore: latestScoreSummary,
    weeklyPoints,
    weeklyPosition,
    roastText: roast?.renderedText ?? null,
    recentAchievements: recentAchievements.map((a) => ({
      key: a.achievement.key,
      name: a.achievement.name,
      icon: a.achievement.icon,
      earnedAt: a.earnedAt,
    })),
    journalPendingToday: !todayJournal || todayJournal.status !== "SUBMITTED",
  };
}
