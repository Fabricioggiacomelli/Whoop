import { differenceInCalendarDays } from "date-fns";

import { db } from "@/server/db";
import { clamp } from "@/server/scoring/helpers";
import type { GoalModel } from "@/generated/prisma/models";

async function countAlcoholFreeDays(userId: string, since: Date): Promise<number> {
  const entries = await db.journalEntry.findMany({
    where: { userId, status: "SUBMITTED", referenceDate: { gte: since } },
    include: { answers: { include: { habit: true } } },
  });

  return entries.filter((e) => {
    const alcohol = e.answers.find((a) => a.habit.key === "alcohol");
    return !alcohol || alcohol.value === "NONE";
  }).length;
}

async function getLatestStreak(userId: string): Promise<number> {
  const latestScore = await db.dailyScore.findFirst({
    where: { userId },
    orderBy: { competitiveDate: "desc" },
    include: { components: true },
  });
  const consistency = latestScore?.components.find((c) => c.category === "CONSISTENCY");
  return (
    (consistency?.baselineComparison as { consecutiveDaysWithData?: number } | null)?.consecutiveDaysWithData ?? 0
  );
}

/** Gera sugestões automáticas — só entram em vigor após aprovação do usuário (brief §19). */
export async function generateSuggestionsForUser(userId: string) {
  const pendingCount = await db.goalSuggestion.count({ where: { userId, resolvedAt: null } });
  if (pendingCount > 0) return;

  const baseline = await db.userBaseline.findFirst({ where: { userId }, orderBy: { computedAt: "desc" } });
  const streak = await getLatestStreak(userId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const alcoholFreeDays = await countAlcoholFreeDays(userId, thirtyDaysAgo);

  const candidates: Array<{
    title: string;
    metric: string;
    targetValue: number;
    category: "SLEEP" | "RECOVERY" | "STRAIN" | "HABITS" | "CONSISTENCY" | "OTHER";
    rationale: string;
  }> = [];

  if (baseline?.avgSleepPerfPct && Number(baseline.avgSleepPerfPct) < 82) {
    const current = Math.round(Number(baseline.avgSleepPerfPct));
    candidates.push({
      title: "Aumentar Sleep Performance média",
      metric: "sleep_performance_avg",
      targetValue: Math.min(95, current + 10),
      category: "SLEEP",
      rationale: `Sua média atual é ${current}%.`,
    });
  }

  if (streak < 7) {
    candidates.push({
      title: "Reconstruir uma sequência de 7 dias",
      metric: "consistency_streak",
      targetValue: 7,
      category: "CONSISTENCY",
      rationale: `Sua sequência atual é de ${streak} dia(s).`,
    });
  }

  if (alcoholFreeDays < 24) {
    candidates.push({
      title: "Reduzir álcool nos próximos 14 dias",
      metric: "alcohol_free_days",
      targetValue: 12,
      category: "HABITS",
      rationale: `Nos últimos 30 dias você teve ${alcoholFreeDays} dias sem álcool.`,
    });
  }

  for (const candidate of candidates.slice(0, 2)) {
    await db.goalSuggestion.create({ data: { userId, ...candidate } });
  }
}

export async function getGoalProgressPercent(goal: GoalModel): Promise<number> {
  const daysElapsed = clamp(differenceInCalendarDays(new Date(), goal.cycleStartDate), 0, goal.cycleLengthDays);
  const timeProgress = (daysElapsed / goal.cycleLengthDays) * 100;

  if (!goal.targetValue) return round1(timeProgress);
  const target = Number(goal.targetValue);

  if (goal.metric === "sleep_performance_avg") {
    const baseline = await db.userBaseline.findFirst({
      where: { userId: goal.userId },
      orderBy: { computedAt: "desc" },
    });
    if (baseline?.avgSleepPerfPct) {
      return round1(clamp((Number(baseline.avgSleepPerfPct) / target) * 100, 0, 100));
    }
  }

  if (goal.metric === "consistency_streak") {
    const streak = await getLatestStreak(goal.userId);
    return round1(clamp((streak / target) * 100, 0, 100));
  }

  if (goal.metric === "alcohol_free_days") {
    const alcoholFreeDays = await countAlcoholFreeDays(goal.userId, goal.cycleStartDate);
    return round1(clamp((alcoholFreeDays / target) * 100, 0, 100));
  }

  return round1(timeProgress);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
