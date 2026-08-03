import { db } from "@/server/db";
import { dailyPeriodKey, getPreviousPeriodKey } from "@/server/services/ranking.service";

type RoastContext = {
  totalPoints: number;
  position: number | null;
  totalAthletes: number;
  positionChange: number | null;
  sleepPerformancePct: number | null;
  recoveryScore: number | null;
  strain: number | null;
  strainMax: number | null;
  trained: boolean;
  alcoholDoses: number;
  streak: number;
};

type RoastTemplate = {
  key: string;
  priority: number;
  matches: (ctx: RoastContext) => boolean;
  render: (ctx: RoastContext) => string;
};

/**
 * Templates determinísticos — "sem piedade", mas nunca sobre aparência, saúde, identidade
 * ou qualquer coisa fora do controle da pessoa. Só fatos de telemetria e decisões do dia.
 * Ver SCORING.md/brief §21. IA fica para depois, com moderação (fora de escopo do MVP).
 */
const TEMPLATES: RoastTemplate[] = [
  {
    key: "last_place",
    priority: 10,
    matches: (ctx) => ctx.totalAthletes > 1 && ctx.position === ctx.totalAthletes,
    render: (ctx) =>
      `Último lugar hoje com ${ctx.totalPoints.toFixed(1)} pontos. Pelo menos a consistência em ficar atrás está impecável.`,
  },
  {
    key: "overtraining",
    priority: 9,
    matches: (ctx) => ctx.trained && ctx.strain != null && ctx.strainMax != null && ctx.strain > ctx.strainMax * 1.2,
    render: (ctx) =>
      `Recovery ${ctx.recoveryScore != null && ctx.recoveryScore < 34 ? "vermelha" : "controlada"}, Strain ${ctx.strain?.toFixed(1)} e zero bom senso. Motor fundido.`,
  },
  {
    key: "low_sleep",
    priority: 8,
    matches: (ctx) => ctx.sleepPerformancePct != null && ctx.sleepPerformancePct < 60,
    render: (ctx) =>
      `Dormiu com Sleep Performance de ${ctx.sleepPerformancePct?.toFixed(0)}% e esperava alta performance. Confiança não falta.`,
  },
  {
    key: "alcohol",
    priority: 8,
    matches: (ctx) => ctx.alcoholDoses >= 2,
    render: (ctx) => `${ctx.alcoholDoses} doses ontem à noite. O fígado pontuou, você não.`,
  },
  {
    key: "fell_positions",
    priority: 7,
    matches: (ctx) => (ctx.positionChange ?? 0) < -1,
    render: (ctx) => `Caiu ${Math.abs(ctx.positionChange ?? 0)} posições no ranking. Escorregou geral.`,
  },
  {
    key: "smart_rest",
    priority: 6,
    matches: (ctx) => !ctx.trained && ctx.recoveryScore != null && ctx.recoveryScore < 34,
    render: () => `Recovery vermelha e ficou parado. Rara demonstração de bom senso por aqui.`,
  },
  {
    key: "streak_broken",
    priority: 6,
    matches: (ctx) => ctx.streak === 0,
    render: () => `Sequência zerada. Já pode personalizar a vaga no fundo da tabela.`,
  },
  {
    key: "leader",
    priority: 5,
    matches: (ctx) => ctx.position === 1 && ctx.totalAthletes > 1,
    render: (ctx) => `Líder do dia com ${ctx.totalPoints.toFixed(1)} pontos. Aproveita antes que alguém acorde.`,
  },
  {
    key: "solid_streak",
    priority: 4,
    matches: (ctx) => ctx.streak >= 7,
    render: (ctx) => `${ctx.streak} dias seguidos com dados completos. Chato de tão consistente.`,
  },
  {
    key: "solid_day",
    priority: 1,
    matches: () => true,
    render: (ctx) => `${ctx.totalPoints.toFixed(1)} pontos hoje. Sem drama, sem glória.`,
  },
];

async function buildContext(userId: string, competitiveDate: Date): Promise<RoastContext | null> {
  const dailyScore = await db.dailyScore.findFirst({
    where: { userId, competitiveDate },
    include: { components: true },
  });
  if (!dailyScore) return null;

  const strainComponent = dailyScore.components.find((c) => c.category === "STRAIN");
  const strainBaseline = strainComponent?.baselineComparison as {
    strain?: number;
    recommendedMax?: number;
  } | null;

  const performance = await db.dailyPerformance.findUnique({
    where: { userId_competitiveDate: { userId, competitiveDate } },
  });

  const cycle = performance?.cycleId
    ? await db.whoopCycle.findUnique({ where: { id: performance.cycleId }, include: { sleeps: true, recovery: true } })
    : null;
  const mainSleep = cycle?.sleeps.find((s) => !s.isNap) ?? null;

  const journalAnswers = performance?.journalEntryId
    ? await db.journalAnswer.findMany({
        where: { journalEntryId: performance.journalEntryId },
        include: { habit: true },
      })
    : [];
  const alcoholAnswer = journalAnswers.find((a) => a.habit.key === "alcohol")?.value;
  const alcoholDoses = { NONE: 0, ONE_DRINK: 1, TWO_DRINKS: 2, THREE_PLUS: 3 }[alcoholAnswer ?? "NONE"] ?? 0;

  const periodKey = dailyPeriodKey(competitiveDate);
  const dailySnapshots = await db.rankingSnapshot.findMany({ where: { scope: "DAILY", periodKey } });
  const mine = dailySnapshots.find((s) => s.userId === userId);

  const previousPeriodKey = await getPreviousPeriodKey("DAILY", periodKey);
  const previousSnapshots = previousPeriodKey
    ? await db.rankingSnapshot.findMany({ where: { scope: "DAILY", periodKey: previousPeriodKey } })
    : [];
  const previousMine = previousSnapshots.find((s) => s.userId === userId);

  const consistencyComponent = dailyScore.components.find((c) => c.category === "CONSISTENCY");
  const streak = (consistencyComponent?.baselineComparison as { consecutiveDaysWithData?: number } | null)
    ?.consecutiveDaysWithData ?? 0;

  return {
    totalPoints: Number(dailyScore.totalPoints),
    position: mine?.position ?? null,
    totalAthletes: dailySnapshots.length,
    positionChange: previousMine && mine ? previousMine.position - mine.position : null,
    sleepPerformancePct: mainSleep?.sleepPerformancePct != null ? Number(mainSleep.sleepPerformancePct) : null,
    recoveryScore: cycle?.recovery?.recoveryScore != null ? Number(cycle.recovery.recoveryScore) : null,
    strain: strainBaseline?.strain ?? null,
    strainMax: strainBaseline?.recommendedMax ?? null,
    trained: (cycle?.strain != null ? Number(cycle.strain) : 0) > 0,
    alcoholDoses,
    streak,
  };
}

export async function generateRoastForUser(userId: string, competitiveDate: Date) {
  const ctx = await buildContext(userId, competitiveDate);
  if (!ctx) return null;

  const recent = await db.roast.findMany({
    where: { targetUserId: userId },
    orderBy: { date: "desc" },
    take: 3,
    select: { templateKey: true },
  });
  const recentKeys = new Set(recent.map((r) => r.templateKey));

  const candidates = TEMPLATES.filter((t) => t.matches(ctx)).sort((a, b) => b.priority - a.priority);
  const chosen = candidates.find((t) => !recentKeys.has(t.key)) ?? candidates[0];

  const renderedText = chosen.render(ctx);

  const existing = await db.roast.findFirst({ where: { targetUserId: userId, date: competitiveDate } });
  if (existing) {
    return db.roast.update({
      where: { id: existing.id },
      data: { templateKey: chosen.key, renderedText, triggerMetric: ctx as never },
    });
  }

  return db.roast.create({
    data: {
      targetUserId: userId,
      date: competitiveDate,
      templateKey: chosen.key,
      renderedText,
      triggerMetric: ctx as never,
    },
  });
}

export async function getLatestRoast(userId: string) {
  return db.roast.findFirst({ where: { targetUserId: userId }, orderBy: { date: "desc" } });
}
