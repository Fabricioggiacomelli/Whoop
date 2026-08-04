import { addDays, addMonths, format, startOfMonth, startOfWeek } from "date-fns";

import { db } from "@/server/db";
import { previewDailyScore } from "@/server/scoring/engine";
import type { RankingScope } from "@/generated/prisma/enums";

/**
 * `competitiveDate` já é um valor de data pura (sem hora) decidido no fechamento do dia —
 * a conversão de timezone relevante (APP_TIMEZONE, América/São_Paulo por padrão) acontece
 * lá, não aqui. Aqui só fazemos aritmética de calendário (semana começando na segunda).
 *
 * IMPORTANTE: uma coluna `@db.Date` do Postgres, quando lida de volta pelo Prisma, vem
 * como meia-noite **UTC** (ex: "2026-08-02T00:00:00.000Z") — mas o `date-fns` formata em
 * horário LOCAL do processo. Num fuso negativo (América/São_Paulo, UTC-3), formatar essa
 * meia-noite UTC em horário local cai no dia ANTERIOR (21h do dia 1º de agosto), voltando
 * uma data inteira. `toCalendarDate` extrai ano/mês/dia em UTC (o valor real gravado no
 * banco) e reconstrói como horário local antes de formatar, funcionando tanto para valores
 * vindos do Prisma quanto para os construídos localmente via `setHours(0,0,0,0)` em
 * `whoop.sync.ts`.
 */
function toCalendarDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function dailyPeriodKey(date: Date): string {
  return format(toCalendarDate(date), "yyyy-MM-dd");
}

export function weeklyPeriodKey(date: Date): string {
  return format(startOfWeek(toCalendarDate(date), { weekStartsOn: 1 }), "RRRR-'W'II");
}

export function monthlyPeriodKey(date: Date): string {
  return format(toCalendarDate(date), "yyyy-MM");
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

export type LiveDailyRow = RankingRow & { inProgress: boolean };

/**
 * Ranking do dia calculado na hora, sem depender de `RankingSnapshot` (que só existe pra
 * dias fechados). Quem já fechou o dia entra com a nota final; quem ainda está em
 * andamento entra com uma prévia calculada pela mesma fórmula, sem persistir nada — o
 * número muda a cada consulta até o dia fechar de verdade. Quem não tem ciclo nenhum ainda
 * hoje fica de fora (não zerado — sem dado ainda, não é o mesmo que "zero pontos").
 */
export async function getLiveDailyRanking(date: Date): Promise<LiveDailyRow[]> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    include: { profile: true, colorAssignment: true },
  });

  const performances = await db.dailyPerformance.findMany({
    where: { userId: { in: users.map((u) => u.id) }, competitiveDate: date },
    include: { dailyScores: true },
  });
  const perfByUser = new Map(performances.map((p) => [p.userId, p]));

  console.log("LIVE_RANKING_DEBUG", {
    date: date.toISOString(),
    usersCount: users.length,
    userIds: users.map((u) => u.id),
    performancesCount: performances.length,
    performances: performances.map((p) => ({
      userId: p.userId,
      status: p.status,
      competitiveDate: p.competitiveDate.toISOString(),
      hasScore: p.dailyScores.length > 0,
    })),
  });

  const rows = (
    await Promise.all(
      users.map(async (user) => {
        const perf = perfByUser.get(user.id);
        if (!perf) {
          console.log("LIVE_RANKING_SKIP", { userId: user.id, reason: "no_performance" });
          return null;
        }

        const closedScore = perf.dailyScores[0];
        let points: number;
        let inProgress: boolean;

        if ((perf.status === "CLOSED" || perf.status === "REPROCESSED") && closedScore) {
          points = Number(closedScore.totalPoints);
          inProgress = false;
        } else {
          let preview: { totalPoints: number } | null = null;
          try {
            preview = await previewDailyScore(user.id, date);
          } catch (error) {
            console.log("LIVE_RANKING_PREVIEW_ERROR", { userId: user.id, message: (error as Error).message });
            return null;
          }
          if (!preview) {
            console.log("LIVE_RANKING_SKIP", { userId: user.id, reason: "preview_null" });
            return null;
          }
          points = preview.totalPoints;
          inProgress = true;
        }

        return {
          userId: user.id,
          nickname: user.profile?.nickname ?? user.email,
          avatarUrl: user.profile?.avatarUrl ?? null,
          colorHex: user.colorAssignment?.hex ?? null,
          points,
          inProgress,
        };
      }),
    )
  ).filter((r): r is Exclude<typeof r, null> => r !== null);

  const sorted = [...rows].sort((a, b) => b.points - a.points);
  return sorted.map((r, index) => ({ ...r, position: index + 1 }));
}
