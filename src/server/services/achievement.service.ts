import { db } from "@/server/db";
import { getPreviousPeriodKey, dailyPeriodKey } from "@/server/services/ranking.service";
import type { AchievementRarity } from "@/generated/prisma/enums";

type CatalogEntry = {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  rule: Record<string, unknown>;
};

/** Catálogo do brief §22 — regras documentadas aqui, avaliadas em `evaluateAchievementsForUser`. */
export const ACHIEVEMENT_CATALOG: CatalogEntry[] = [
  { key: "rei_do_sono", name: "Rei do Sono", description: "Melhor média de Sono do grupo em 30 dias.", icon: "👑", rarity: "EPIC", rule: { window: 30, metric: "sleep_avg", comparison: "best_in_group" } },
  { key: "maquina", name: "Máquina", description: "Mais treinos registrados em 90 dias.", icon: "⚙️", rarity: "EPIC", rule: { window: 90, metric: "workout_count", comparison: "best_in_group" } },
  { key: "redline", name: "Redline", description: "Treinou bem acima da faixa recomendada de Strain.", icon: "🔴", rarity: "RARE", rule: { metric: "strain_overage_tier", comparison: "tier2_or_worse" } },
  { key: "freio_motor", name: "Freio Motor", description: "Descansou com Recovery baixa — decisão inteligente.", icon: "🛑", rarity: "COMMON", rule: { metric: "smart_rest" } },
  { key: "comeback", name: "Comeback", description: "Subiu 2 ou mais posições no ranking em um dia.", icon: "📈", rarity: "RARE", rule: { metric: "position_jump", min: 2 } },
  { key: "monstro_da_consistencia", name: "Monstro da Consistência", description: "14 dias seguidos com dados completos.", icon: "🧱", rarity: "EPIC", rule: { metric: "streak", min: 14 } },
  { key: "pole_position", name: "Pole Position", description: "1º lugar no ranking diário.", icon: "🏁", rarity: "COMMON", rule: { metric: "daily_position", value: 1 } },
  { key: "volta_mais_rapida", name: "Volta Mais Rápida", description: "Maior salto de pontuação de um dia para o outro.", icon: "⚡", rarity: "RARE", rule: { window: 90, metric: "biggest_day_over_day_gain", comparison: "best_in_group" } },
  { key: "dorminhoco_profissional", name: "Dorminhoco Profissional", description: "Melhor Sono do grupo no dia.", icon: "😴", rarity: "COMMON", rule: { metric: "sleep_component", comparison: "best_in_group_daily" } },
  { key: "safety_car", name: "Safety Car", description: "Ativou o modo recuperação e manteve a consistência.", icon: "🚧", rarity: "COMMON", rule: { metric: "recovery_mode_active" } },
  { key: "motor_fundido", name: "Motor Fundido", description: "Excesso de Strain repetido — overtraining.", icon: "💥", rarity: "RARE", rule: { metric: "strain_overage_repeated" } },
  { key: "ultimo_do_grid", name: "Último do Grid", description: "Último lugar no ranking diário.", icon: "🔻", rarity: "COMMON", rule: { metric: "daily_position", comparison: "last" } },
  { key: "melhor_recovery", name: "Melhor Recovery", description: "Melhor média de Recovery do grupo em 30 dias.", icon: "💚", rarity: "RARE", rule: { window: 30, metric: "recovery_avg", comparison: "best_in_group" } },
  { key: "mestre_do_hrv", name: "Mestre do HRV", description: "Maior evolução relativa de HRV do grupo.", icon: "🧬", rarity: "EPIC", rule: { metric: "hrv_trend", comparison: "best_in_group" } },
  { key: "rei_do_cardio", name: "Rei do Cardio", description: "Mais treinos de cardio em 30 dias.", icon: "🏃", rarity: "RARE", rule: { window: 30, metric: "cardio_count", comparison: "best_in_group" } },
  { key: "disciplina_de_ferro", name: "Disciplina de Ferro", description: "30 dias seguidos respondendo o Journal.", icon: "🔩", rarity: "EPIC", rule: { metric: "journal_streak", min: 30 } },
  { key: "noite_perfeita", name: "Noite Perfeita", description: "Nota de Sono quase máxima em um dia.", icon: "🌙", rarity: "COMMON", rule: { metric: "sleep_component", min: 23 } },
  { key: "semana_perfeita", name: "Semana Perfeita", description: "7 dias seguidos em 1º no ranking diário.", icon: "🏆", rarity: "LEGENDARY", rule: { metric: "daily_wins_streak", min: 7 } },
  { key: "recuperacao_inteligente", name: "Recuperação Inteligente", description: "Descansou em dia de Recovery baixa e manteve a consistência.", icon: "🧠", rarity: "RARE", rule: { metric: "smart_rest_high_consistency" } },
];

export async function syncAchievementCatalog() {
  for (const entry of ACHIEVEMENT_CATALOG) {
    await db.achievement.upsert({
      where: { key: entry.key },
      create: { ...entry, rule: entry.rule as never },
      update: {
        name: entry.name,
        description: entry.description,
        icon: entry.icon,
        rarity: entry.rarity,
        rule: entry.rule as never,
      },
    });
  }
}

async function grantOnce(userId: string, achievementKey: string, earnedAt: Date, periodLabel?: string, metricSnapshot?: unknown) {
  const achievement = await db.achievement.findUniqueOrThrow({ where: { key: achievementKey } });

  const existing = await db.userAchievement.findFirst({
    where: { userId, achievementId: achievement.id, earnedAt },
  });
  if (existing) return existing;

  return db.userAchievement.create({
    data: {
      userId,
      achievementId: achievement.id,
      earnedAt,
      periodLabel,
      metricSnapshot: metricSnapshot as never,
    },
  });
}

/** Avalia as conquistas "por dia" (repetíveis) para um usuário ao longo de todo o histórico. */
async function evaluateDailyAchievements(userId: string) {
  const scores = await db.dailyScore.findMany({
    where: { userId },
    orderBy: { competitiveDate: "asc" },
    include: { components: { include: { adjustments: true } } },
  });

  let dailyWinStreak = 0;
  let maxDailyWinStreak = 0;

  for (const [index, score] of scores.entries()) {
    const periodKey = dailyPeriodKey(score.competitiveDate);
    const snapshot = await db.rankingSnapshot.findUnique({
      where: { scope_periodKey_userId: { scope: "DAILY", periodKey, userId } },
    });
    const totalAthletes = await db.rankingSnapshot.count({ where: { scope: "DAILY", periodKey } });

    const sleepComponent = score.components.find((c) => c.category === "SLEEP");
    const strainComponent = score.components.find((c) => c.category === "STRAIN");
    const consistencyComponent = score.components.find((c) => c.category === "CONSISTENCY");
    const strainInput = strainComponent?.inputValue as { strain?: number; trained?: boolean } | null;
    const strainBaseline = strainComponent?.baselineComparison as { recommendedMax?: number } | null;

    if (snapshot?.position === 1 && totalAthletes > 1) {
      await grantOnce(userId, "pole_position", score.competitiveDate);
      dailyWinStreak += 1;
    } else {
      dailyWinStreak = 0;
    }
    maxDailyWinStreak = Math.max(maxDailyWinStreak, dailyWinStreak);

    if (snapshot && totalAthletes > 1 && snapshot.position === totalAthletes) {
      await grantOnce(userId, "ultimo_do_grid", score.competitiveDate);
    }

    if (sleepComponent && Number(sleepComponent.pointsEarned) >= 23) {
      await grantOnce(userId, "noite_perfeita", score.competitiveDate);
    }

    if (strainInput?.trained && strainInput.strain != null && strainBaseline?.recommendedMax) {
      const overagePct = ((strainInput.strain - strainBaseline.recommendedMax) / strainBaseline.recommendedMax) * 100;
      if (overagePct >= 20) {
        await grantOnce(userId, "redline", score.competitiveDate);
      }
    }

    const hasOvertrainingPenalty = strainComponent?.adjustments.some(
      (a) => a.ruleKey === "strain.overage.repeated",
    );
    if (hasOvertrainingPenalty) {
      await grantOnce(userId, "motor_fundido", score.competitiveDate);
    }

    const recoveryComponent = score.components.find((c) => c.category === "RECOVERY");
    const recoveryInput = recoveryComponent?.inputValue as { recoveryScore?: number } | null;
    const isLowRecovery = (recoveryInput?.recoveryScore ?? 100) < 34;

    if (!strainInput?.trained && isLowRecovery) {
      await grantOnce(userId, "freio_motor", score.competitiveDate);
      if (consistencyComponent && Number(consistencyComponent.pointsEarned) >= 10) {
        await grantOnce(userId, "recuperacao_inteligente", score.competitiveDate);
      }
    }

    if (index > 0) {
      const previousPeriodKey = await getPreviousPeriodKey("DAILY", periodKey);
      if (previousPeriodKey) {
        const previousSnapshot = await db.rankingSnapshot.findUnique({
          where: { scope_periodKey_userId: { scope: "DAILY", periodKey: previousPeriodKey, userId } },
        });
        if (previousSnapshot && snapshot && previousSnapshot.position - snapshot.position >= 2) {
          await grantOnce(userId, "comeback", score.competitiveDate);
        }
      }
    }
  }

  if (maxDailyWinStreak >= 7) {
    await grantOnce(userId, "semana_perfeita", scores[scores.length - 1].competitiveDate, "historico");
  }
}

async function evaluateStreakAchievements(userId: string) {
  const latestBaseline = await db.userBaseline.findFirst({
    where: { userId },
    orderBy: { computedAt: "desc" },
  });

  const latestScore = await db.dailyScore.findFirst({
    where: { userId },
    orderBy: { competitiveDate: "desc" },
    include: { components: true },
  });
  if (!latestScore) return;

  const consistencyComponent = latestScore.components.find((c) => c.category === "CONSISTENCY");
  const streak =
    (consistencyComponent?.baselineComparison as { consecutiveDaysWithData?: number } | null)
      ?.consecutiveDaysWithData ?? 0;

  if (streak >= 14) {
    await grantOnce(userId, "monstro_da_consistencia", latestScore.competitiveDate, "historico");
  }
  if (streak >= 30) {
    await grantOnce(userId, "disciplina_de_ferro", latestScore.competitiveDate, "historico");
  }

  void latestBaseline;
}

/** Achievements comparativos ("melhor do grupo") — avaliados uma vez sobre o histórico inteiro. */
async function evaluateGroupAchievements(userIds: string[], referenceDate: Date) {
  const workoutCounts = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      count: await db.whoopWorkout.count({ where: { userId } }),
    })),
  );
  const topWorkouts = workoutCounts.sort((a, b) => b.count - a.count)[0];
  if (topWorkouts && topWorkouts.count > 0) {
    await grantOnce(topWorkouts.userId, "maquina", referenceDate, "historico", { count: topWorkouts.count });
  }

  const cardioCounts = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      count: await db.whoopWorkout.count({
        where: { userId, sportName: { in: ["Corrida", "Ciclismo"] } },
      }),
    })),
  );
  const topCardio = cardioCounts.sort((a, b) => b.count - a.count)[0];
  if (topCardio && topCardio.count > 0) {
    await grantOnce(topCardio.userId, "rei_do_cardio", referenceDate, "historico", { count: topCardio.count });
  }

  const recoveryAverages = await Promise.all(
    userIds.map(async (userId) => {
      const components = await db.scoreComponent.findMany({
        where: { category: "RECOVERY", dailyScore: { userId } },
        select: { pointsEarned: true },
      });
      const avg = components.length
        ? components.reduce((sum, c) => sum + Number(c.pointsEarned), 0) / components.length
        : 0;
      return { userId, avg };
    }),
  );
  const topRecovery = recoveryAverages.sort((a, b) => b.avg - a.avg)[0];
  if (topRecovery) {
    await grantOnce(topRecovery.userId, "melhor_recovery", referenceDate, "historico", { avg: topRecovery.avg });
  }

  const sleepAverages = await Promise.all(
    userIds.map(async (userId) => {
      const components = await db.scoreComponent.findMany({
        where: { category: "SLEEP", dailyScore: { userId } },
        select: { pointsEarned: true },
      });
      const avg = components.length
        ? components.reduce((sum, c) => sum + Number(c.pointsEarned), 0) / components.length
        : 0;
      return { userId, avg };
    }),
  );
  const topSleep = sleepAverages.sort((a, b) => b.avg - a.avg)[0];
  if (topSleep) {
    await grantOnce(topSleep.userId, "rei_do_sono", referenceDate, "historico", { avg: topSleep.avg });
  }

  const hrvTrends = await Promise.all(
    userIds.map(async (userId) => {
      const baselines = await db.userBaseline.findMany({
        where: { userId },
        orderBy: { computedAt: "desc" },
        take: 1,
      });
      return { userId, hrv: baselines[0]?.avgHrvMs ? Number(baselines[0].avgHrvMs) : 0 };
    }),
  );
  const topHrv = hrvTrends.sort((a, b) => b.hrv - a.hrv)[0];
  if (topHrv && topHrv.hrv > 0) {
    await grantOnce(topHrv.userId, "mestre_do_hrv", referenceDate, "historico", { hrv: topHrv.hrv });
  }

  const dayGains = await Promise.all(
    userIds.map(async (userId) => {
      const scores = await db.dailyScore.findMany({
        where: { userId },
        orderBy: { competitiveDate: "asc" },
        select: { totalPoints: true },
      });
      let maxGain = -Infinity;
      for (let i = 1; i < scores.length; i++) {
        const gain = Number(scores[i].totalPoints) - Number(scores[i - 1].totalPoints);
        if (gain > maxGain) maxGain = gain;
      }
      return { userId, maxGain: Number.isFinite(maxGain) ? maxGain : 0 };
    }),
  );
  const topGain = dayGains.sort((a, b) => b.maxGain - a.maxGain)[0];
  if (topGain && topGain.maxGain > 0) {
    await grantOnce(topGain.userId, "volta_mais_rapida", referenceDate, "historico", { gain: topGain.maxGain });
  }
}

export async function evaluateAllAchievements() {
  await syncAchievementCatalog();

  const users = await db.user.findMany({ where: { role: "PARTICIPANT" }, select: { id: true } });
  const userIds = users.map((u) => u.id);

  for (const userId of userIds) {
    await evaluateDailyAchievements(userId);
    await evaluateStreakAchievements(userId);
  }

  const latestDate = await db.dailyScore.findFirst({ orderBy: { competitiveDate: "desc" }, select: { competitiveDate: true } });
  if (latestDate) {
    await evaluateGroupAchievements(userIds, latestDate.competitiveDate);
  }
}
