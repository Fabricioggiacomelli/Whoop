import { startOfWeek } from "date-fns";

import { db } from "@/server/db";
import { todayInAppTimezone } from "@/lib/timezone";
import { dailyPeriodKey, getPreviousPeriodKey, getRanking } from "@/server/services/ranking.service";
import type { ScoreCategory } from "@/generated/prisma/enums";

type Athlete = { userId: string; nickname: string; colorHex: string | null };

async function getAthletes(): Promise<Athlete[]> {
  const users = await db.user.findMany({
    where: { role: "PARTICIPANT" },
    include: { profile: true, colorAssignment: true },
  });
  return users.map((u) => ({
    userId: u.id,
    nickname: u.profile?.nickname ?? u.email,
    colorHex: u.colorAssignment?.hex ?? null,
  }));
}

async function getGridGeral() {
  const latestDaily = await db.rankingSnapshot.findFirst({ where: { scope: "DAILY" }, orderBy: { periodKey: "desc" } });
  if (!latestDaily) return { rows: [], periodKey: null };

  const rows = await getRanking("DAILY", latestDaily.periodKey);
  const previousKey = await getPreviousPeriodKey("DAILY", latestDaily.periodKey);
  const previousRows = previousKey ? await getRanking("DAILY", previousKey) : [];
  const previousPositions = new Map(previousRows.map((r) => [r.userId, r.position]));

  return {
    periodKey: latestDaily.periodKey,
    rows: rows.map((r) => ({
      ...r,
      trend: previousPositions.has(r.userId) ? previousPositions.get(r.userId)! - r.position : 0,
    })),
  };
}

async function getCorridaDaSemana() {
  const athletes = await getAthletes();
  const latestDay = await db.dailyScore.findFirst({ orderBy: { competitiveDate: "desc" } });
  if (!latestDay) return { days: [], athletes };

  const weekStart = startOfWeek(latestDay.competitiveDate, { weekStartsOn: 1 });

  const scores = await db.dailyScore.findMany({
    where: { competitiveDate: { gte: weekStart, lte: latestDay.competitiveDate } },
    orderBy: { competitiveDate: "asc" },
  });

  const dayKeys = [...new Set(scores.map((s) => dailyPeriodKey(s.competitiveDate)))];

  const cumulative = new Map<string, number>();
  const days = dayKeys.map((key) => {
    const dayScores = scores.filter((s) => dailyPeriodKey(s.competitiveDate) === key);
    const values = athletes.map((a) => {
      const score = dayScores.find((s) => s.userId === a.userId);
      const daily = score ? Number(score.totalPoints) : 0;
      const prevCumulative = cumulative.get(a.userId) ?? 0;
      const newCumulative = prevCumulative + daily;
      cumulative.set(a.userId, newCumulative);
      return { userId: a.userId, daily, cumulative: newCumulative };
    });
    return { periodKey: key, values };
  });

  const projected = athletes.map((a) => {
    const daysElapsed = days.length || 1;
    const total = cumulative.get(a.userId) ?? 0;
    return { userId: a.userId, projectedWeekTotal: Math.round((total / daysElapsed) * 7 * 10) / 10 };
  });

  return { days, athletes, projected };
}

async function getTelemetria() {
  const athletes = await getAthletes();

  const rows = await Promise.all(
    athletes.map(async (a) => {
      const latest = await db.dailyScore.findFirst({
        where: { userId: a.userId },
        orderBy: { competitiveDate: "desc" },
        include: { components: true },
      });
      const connection = await db.whoopConnection.findUnique({ where: { userId: a.userId } });

      const recovery = latest?.components.find((c) => c.category === "RECOVERY");
      const sleep = latest?.components.find((c) => c.category === "SLEEP");
      const strain = latest?.components.find((c) => c.category === "STRAIN");

      const recoveryInput = recovery?.inputValue as { recoveryScore?: number; hrvMs?: number } | null;
      const recoveryBaseline = recovery?.baselineComparison as { baselineAvgHrvMs?: number } | null;
      const sleepInput = sleep?.inputValue as { sleepPerformancePct?: number } | null;
      const strainInput = strain?.inputValue as { strain?: number; trained?: boolean } | null;

      return {
        ...a,
        recoveryScore: recoveryInput?.recoveryScore ?? null,
        hrvRelative:
          recoveryInput?.hrvMs && recoveryBaseline?.baselineAvgHrvMs
            ? Math.round((recoveryInput.hrvMs / recoveryBaseline.baselineAvgHrvMs) * 100)
            : null,
        sleepPerformancePct: sleepInput?.sleepPerformancePct ?? null,
        strain: strainInput?.trained ? (strainInput.strain ?? null) : 0,
        connectionStatus: connection?.status ?? "NOT_CONNECTED",
      };
    }),
  );

  return rows;
}

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  SLEEP: "Sono",
  RECOVERY: "Recovery",
  STRAIN: "Strain adequado",
  CONSISTENCY: "Consistência",
  EVOLUTION: "Evolução",
  HABITS: "Hábitos",
};

async function getCampeoes() {
  const athletes = await getAthletes();
  const categories: ScoreCategory[] = ["SLEEP", "RECOVERY", "STRAIN", "CONSISTENCY", "EVOLUTION", "HABITS"];
  const userIds = athletes.map((a) => a.userId);

  // Uma consulta por categoria (paralelas), não uma por (categoria × atleta) — a versão
  // anterior fazia N consultas sequenciais dentro de cada categoria.
  const champions = await Promise.all(
    categories.map(async (category) => {
      const components = await db.scoreComponent.findMany({
        where: { category, dailyScore: { userId: { in: userIds } } },
        select: { pointsEarned: true, dailyScore: { select: { userId: true } } },
      });

      const totals = new Map<string, { sum: number; count: number }>();
      for (const component of components) {
        const userId = component.dailyScore.userId;
        const entry = totals.get(userId) ?? { sum: 0, count: 0 };
        entry.sum += Number(component.pointsEarned);
        entry.count += 1;
        totals.set(userId, entry);
      }

      let best: { userId: string; avg: number } | null = null;
      for (const [userId, { sum, count }] of totals) {
        const avg = sum / count;
        if (!best || avg > best.avg) best = { userId, avg };
      }

      const athlete = athletes.find((a) => a.userId === best?.userId);
      return {
        category,
        label: CATEGORY_LABELS[category],
        nickname: athlete?.nickname ?? "—",
        colorHex: athlete?.colorHex ?? null,
        avg: best ? Math.round(best.avg * 10) / 10 : null,
      };
    }),
  );

  return champions;
}

async function getConquistas() {
  const recent = await db.userAchievement.findMany({
    orderBy: { earnedAt: "desc" },
    take: 8,
    include: { achievement: true, user: { include: { profile: true, colorAssignment: true } } },
  });

  return recent.map((r) => ({
    name: r.achievement.name,
    icon: r.achievement.icon,
    rarity: r.achievement.rarity,
    nickname: r.user.profile?.nickname ?? "—",
    colorHex: r.user.colorAssignment?.hex ?? null,
    earnedAt: r.earnedAt,
  }));
}

async function getSemPiedade() {
  const athletes = await getAthletes();

  const roasts = await Promise.all(
    athletes.map(async (a) => {
      const roast = await db.roast.findFirst({ where: { targetUserId: a.userId }, orderBy: { date: "desc" } });
      return { ...a, roastText: roast?.renderedText ?? null };
    }),
  );

  const grid = await getGridGeral();
  const lastPlace = grid.rows[grid.rows.length - 1] ?? null;
  const biggestDrop = grid.rows.reduce<{ nickname: string; colorHex: string | null; trend: number } | null>(
    (worst, row) => (row.trend < (worst?.trend ?? 1) ? row : worst),
    null,
  );

  return { roasts, lastPlace, biggestDrop: biggestDrop && biggestDrop.trend < 0 ? biggestDrop : null };
}

async function getPitWall() {
  const athletes = await getAthletes();

  const rows = await Promise.all(
    athletes.map(async (a) => {
      const latest = await db.dailyScore.findFirst({
        where: { userId: a.userId },
        orderBy: { competitiveDate: "desc" },
        include: { components: true },
      });
      const strainRec = latest
        ? await db.strainRecommendation.findUnique({
            where: { userId_competitiveDate: { userId: a.userId, competitiveDate: latest.competitiveDate } },
          })
        : null;

      const recovery = latest?.components.find((c) => c.category === "RECOVERY");
      const strain = latest?.components.find((c) => c.category === "STRAIN");
      const recoveryInput = recovery?.inputValue as { recoveryScore?: number } | null;
      const strainInput = strain?.inputValue as { strain?: number; trained?: boolean } | null;

      const connection = await db.whoopConnection.findUnique({ where: { userId: a.userId } });

      const todayJournal = await db.journalEntry.findUnique({
        where: { userId_referenceDate: { userId: a.userId, referenceDate: todayInAppTimezone() } },
      });

      const overStrain = Boolean(
        strainInput?.trained && strainRec && (strainInput.strain ?? 0) > Number(strainRec.max),
      );
      const shouldRest = (recoveryInput?.recoveryScore ?? 100) < 34;
      const shouldTrain = (recoveryInput?.recoveryScore ?? 0) >= 67;
      const journalPending = !todayJournal || todayJournal.status !== "SUBMITTED";
      const noData = connection?.status !== "CONNECTED" && connection?.status !== "UP_TO_DATE";

      return { ...a, overStrain, shouldRest, shouldTrain, journalPending, noData };
    }),
  );

  return rows;
}

export async function getDisplayData() {
  const [gridGeral, corridaDaSemana, telemetria, campeoes, conquistas, semPiedade, pitWall] = await Promise.all([
    getGridGeral(),
    getCorridaDaSemana(),
    getTelemetria(),
    getCampeoes(),
    getConquistas(),
    getSemPiedade(),
    getPitWall(),
  ]);

  return { gridGeral, corridaDaSemana, telemetria, campeoes, conquistas, semPiedade, pitWall, generatedAt: new Date().toISOString() };
}

export type DisplayData = Awaited<ReturnType<typeof getDisplayData>>;
