import { addDays, addMonths, format, startOfMonth, startOfWeek } from "date-fns";

import { db } from "@/server/db";
import type { RankingScope } from "@/generated/prisma/enums";

/**
 * `competitiveDate` já é um valor de data pura (sem hora) decidido no fechamento do dia —
 * a conversão de timezone relevante (APP_TIMEZONE, América/São_Paulo por padrão) acontece
 * lá, não aqui. Aqui só fazemos aritmética de calendário (semana começando na segunda).
 */

export function dailyPeriodKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function weeklyPeriodKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "RRRR-'W'II");
}

export function monthlyPeriodKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export const ALL_TIME_KEY = "ALL_TIME";

async function sumTotals(gte: Date, lt: Date): Promise<Array<{ userId: string; points: number }>> {
  const grouped = await db.dailyScore.groupBy({
    by: ["userId"],
    where: { competitiveDate: { gte, lt } },
    _sum: { totalPoints: true },
  });

  return grouped.map((g) => ({ userId: g.userId, points: Number(g._sum.totalPoints ?? 0) }));
}

async function writeSnapshot(
  scope: RankingScope,
  periodKey: string,
  totals: Array<{ userId: string; points: number }>,
) {
  const sorted = [...totals].sort((a, b) => b.points - a.points);

  await db.$transaction(
    sorted.map((t, index) =>
      db.rankingSnapshot.upsert({
        where: { scope_periodKey_userId: { scope, periodKey, userId: t.userId } },
        create: { scope, periodKey, userId: t.userId, points: t.points, position: index + 1 },
        update: { points: t.points, position: index + 1, computedAt: new Date() },
      }),
    ),
  );
}

export async function recomputeDailyRanking(date: Date) {
  const totals = await sumTotals(date, addDays(date, 1));
  await writeSnapshot("DAILY", dailyPeriodKey(date), totals);
}

export async function recomputeWeeklyRanking(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const totals = await sumTotals(weekStart, addDays(weekStart, 7));
  await writeSnapshot("WEEKLY", weeklyPeriodKey(date), totals);
}

export async function recomputeMonthlyRanking(date: Date) {
  const monthStart = startOfMonth(date);
  const totals = await sumTotals(monthStart, startOfMonth(addMonths(date, 1)));
  await writeSnapshot("MONTHLY", monthlyPeriodKey(date), totals);
}

const FAR_FUTURE = new Date("9999-12-31T00:00:00.000Z");

export async function recomputeAllTimeRanking() {
  const totals = await sumTotals(new Date(0), FAR_FUTURE);
  await writeSnapshot("ALL_TIME", ALL_TIME_KEY, totals);
}

/** Recalcula os 4 escopos para o dia informado (usado após a engine rodar para uma data). */
export async function recomputeRankingsForDate(date: Date) {
  await Promise.all([
    recomputeDailyRanking(date),
    recomputeWeeklyRanking(date),
    recomputeMonthlyRanking(date),
    recomputeAllTimeRanking(),
  ]);
}

export async function getLatestPeriodKey(scope: RankingScope): Promise<string | null> {
  const latest = await db.rankingSnapshot.findFirst({
    where: { scope },
    orderBy: { periodKey: "desc" },
    select: { periodKey: true },
  });
  return latest?.periodKey ?? null;
}

export async function getPreviousPeriodKey(
  scope: RankingScope,
  currentPeriodKey: string,
): Promise<string | null> {
  const prev = await db.rankingSnapshot.findFirst({
    where: { scope, periodKey: { lt: currentPeriodKey } },
    orderBy: { periodKey: "desc" },
    select: { periodKey: true },
  });
  return prev?.periodKey ?? null;
}

export type RankingRow = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  colorHex: string | null;
  points: number;
  position: number;
};

export async function getRanking(scope: RankingScope, periodKey: string): Promise<RankingRow[]> {
  const snapshots = await db.rankingSnapshot.findMany({
    where: { scope, periodKey },
    orderBy: { position: "asc" },
    include: { user: { include: { profile: true, colorAssignment: true } } },
  });

  return snapshots.map((s) => ({
    userId: s.userId,
    nickname: s.user.profile?.nickname ?? s.user.email,
    avatarUrl: s.user.profile?.avatarUrl ?? null,
    colorHex: s.user.colorAssignment?.hex ?? null,
    points: Number(s.points),
    position: s.position,
  }));
}
