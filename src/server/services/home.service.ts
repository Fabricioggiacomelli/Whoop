import { db } from "@/server/db";
import { dailyPeriodKey, weeklyPeriodKey } from "@/server/services/ranking.service";
import { getLatestRoast } from "@/server/services/roast.service";

export type HomeSummary = {
  today: {
    competitiveDate: Date;
    inProgress: boolean;
    totalPoints: number | null;
    position: number | null;
    totalAthletes: number | null;
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

/** Sequência de dias fechados até o mais recente — usada mesmo quando hoje ainda está em
 * andamento (a sequência "conta" até ontem enquanto hoje não fecha). */
async function getLatestStreak(userId: string): Promise<number> {
  const latestClosedScore = await db.dailyScore.findFirst({
    where: { userId },
    orderBy: { competitiveDate: "desc" },
    include: { components: { where: { category: "CONSISTENCY" } } },
  });
  const consistencyComp = latestClosedScore?.components[0];
  return (
    (consistencyComp?.baselineComparison as { consecutiveDaysWithData?: number } | null)
      ?.consecutiveDaysWithData ?? 0
  );
}

export async function getHomeSummary(userId: string): Promise<HomeSummary> {
  const today = todayLocalMidnight();

  const [performance, roast, recentAchievements, todayJournal, streak, strainRec] = await Promise.all([
    db.dailyPerformance.findFirst({
      where: { userId, competitiveDate: today },
      include: { dailyScores: { include: { components: true } } },
    }),
    getLatestRoast(userId),
    db.userAchievement.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      take: 3,
      include: { achievement: true },
    }),
    db.journalEntry.findUnique({
      where: { userId_referenceDate: { userId, referenceDate: today } },
    }),
    getLatestStreak(userId),
    db.strainRecommendation.findUnique({
      where: { userId_competitiveDate: { userId, competitiveDate: today } },
    }),
  ]);

  let todaySummary: HomeSummary["today"] = null;
  let weeklyPoints: number | null = null;
  let weeklyPosition: number | null = null;

  const weeklyKey = weeklyPeriodKey(today);
  const weeklyPromise = db.rankingSnapshot.findUnique({
    where: { scope_periodKey_userId: { scope: "WEEKLY", periodKey: weeklyKey, userId } },
  });

  const closedScore = performance?.dailyScores[0] ?? null;

  if (performance && closedScore) {
    // Dia fechado — nota final e posição no ranking do dia.
    const periodKey = dailyPeriodKey(closedScore.competitiveDate);
    const [snapshots, weekly] = await Promise.all([
      db.rankingSnapshot.findMany({ where: { scope: "DAILY", periodKey }, orderBy: { position: "asc" } }),
      weeklyPromise,
    ]);
    const mine = snapshots.find((s) => s.userId === userId);
    const leader = snapshots[0];

    const sleepComp = closedScore.components.find((c) => c.category === "SLEEP");
    const recoveryComp = closedScore.components.find((c) => c.category === "RECOVERY");
    const strainComp = closedScore.components.find((c) => c.category === "STRAIN");

    const recoveryInput = recoveryComp?.inputValue as { recoveryScore?: number } | null;
    const sleepInput = sleepComp?.inputValue as { sleepPerformancePct?: number } | null;
    const strainInput = strainComp?.inputValue as { strain?: number; trained?: boolean } | null;

    todaySummary = {
      competitiveDate: closedScore.competitiveDate,
      inProgress: false,
      totalPoints: Number(closedScore.totalPoints),
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
    weeklyPoints = weekly ? Number(weekly.points) : null;
    weeklyPosition = weekly?.position ?? null;
  } else {
    // Ciclo de hoje ainda em andamento (ou nenhum ciclo sincronizado ainda) — mostra o que
    // já temos (recovery e sono já são finais assim que acorda; só o strain segue subindo
    // até dormir de novo).
    const cycle = performance?.cycleId
      ? await db.whoopCycle.findUnique({ where: { id: performance.cycleId }, include: { sleeps: true, recovery: true } })
      : null;

    if (cycle) {
      const mainSleep = cycle.sleeps.find((s) => !s.isNap) ?? null;
      const strain = cycle.strain != null ? Number(cycle.strain) : null;
      const trained = (strain ?? 0) > 0;

      todaySummary = {
        competitiveDate: performance!.competitiveDate,
        inProgress: true,
        totalPoints: null,
        position: null,
        totalAthletes: null,
        pointsBehindLeader: null,
        recoveryScore: cycle.recovery?.recoveryScore != null ? Number(cycle.recovery.recoveryScore) : null,
        sleepPerformancePct: mainSleep?.sleepPerformancePct != null ? Number(mainSleep.sleepPerformancePct) : null,
        strain,
        trained,
        strainMin: strainRec ? Number(strainRec.min) : null,
        strainMax: strainRec ? Number(strainRec.max) : null,
        overtrainingRisk: Boolean(trained && strainRec && (strain ?? 0) > Number(strainRec.max)),
        streak,
      };
    }

    const weekly = await weeklyPromise;
    weeklyPoints = weekly ? Number(weekly.points) : null;
    weeklyPosition = weekly?.position ?? null;
  }

  return {
    today: todaySummary,
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
