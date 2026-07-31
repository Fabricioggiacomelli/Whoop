import { db } from "@/server/db";
import { logger } from "@/lib/logger";

import { computeBaseline, persistBaselineSnapshot } from "./baseline";
import { computeHistoryContext } from "./history";
import { scoreConsistency } from "./consistency.scorer";
import { scoreEvolution } from "./evolution.scorer";
import { scoreHabits } from "./habit.scorer";
import { scoreRecovery } from "./recovery.scorer";
import { scoreSleep } from "./sleep.scorer";
import { scoreStrain } from "./strain.scorer";
import type { DayInput, RecoveryModeInfo, RulesMap, ScorerInput, ScorerResult } from "./types";
import type { ScoreCategory } from "@/generated/prisma/enums";

const DEFAULT_SCORING_VERSION_KEY = "v1";

async function loadRules(scoringVersionKey: string): Promise<{ versionId: string; rules: RulesMap }> {
  const version = await db.scoringVersion.findUniqueOrThrow({
    where: { key: scoringVersionKey },
    include: { rules: true },
  });

  const rules = new Map(version.rules.map((r) => [r.key, r.value]));
  return { versionId: version.id, rules };
}

async function buildDayInput(userId: string, dailyPerformanceId: string): Promise<DayInput | null> {
  const performance = await db.dailyPerformance.findUniqueOrThrow({
    where: { id: dailyPerformanceId },
  });

  const cycle = performance.cycleId
    ? await db.whoopCycle.findUnique({
        where: { id: performance.cycleId },
        include: { sleep: true, recovery: true },
      })
    : null;

  const journalAnswers = performance.journalEntryId
    ? await db.journalAnswer.findMany({
        where: { journalEntryId: performance.journalEntryId },
        include: { habit: true },
      })
    : [];

  const journalEntry = performance.journalEntryId
    ? await db.journalEntry.findUnique({ where: { id: performance.journalEntryId } })
    : null;

  const answersRecord =
    journalEntry?.status === "SUBMITTED"
      ? Object.fromEntries(journalAnswers.map((a) => [a.habit.key, a.value]))
      : null;

  const strain = cycle?.strain != null ? Number(cycle.strain) : null;

  return {
    competitiveDate: performance.competitiveDate,
    sleep: cycle?.sleep
      ? {
          sleepPerformancePct: cycle.sleep.sleepPerformancePct != null ? Number(cycle.sleep.sleepPerformancePct) : null,
          sleepEfficiencyPct: cycle.sleep.sleepEfficiencyPct != null ? Number(cycle.sleep.sleepEfficiencyPct) : null,
          sleepNeedMinutes: cycle.sleep.sleepNeedMinutes,
          timeInBedMinutes: cycle.sleep.timeInBedMinutes,
          remMinutes: cycle.sleep.remMinutes,
          deepMinutes: cycle.sleep.deepMinutes,
          disturbanceCount: cycle.sleep.disturbanceCount,
          sleepDebtMinutes: cycle.sleep.sleepDebtMinutes,
          startedAt: cycle.sleep.startedAt,
        }
      : null,
    recovery: cycle?.recovery
      ? {
          recoveryScore: cycle.recovery.recoveryScore != null ? Number(cycle.recovery.recoveryScore) : null,
          hrvMs: cycle.recovery.hrvMs != null ? Number(cycle.recovery.hrvMs) : null,
          restingHeartRate:
            cycle.recovery.restingHeartRate != null ? Number(cycle.recovery.restingHeartRate) : null,
        }
      : null,
    strain,
    trained: (strain ?? 0) > 0,
    journalAnswers: answersRecord,
  };
}

async function loadActiveRecoveryMode(userId: string, date: Date): Promise<RecoveryModeInfo> {
  const mode = await db.recoveryMode.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  return mode ? { type: mode.type } : null;
}

export type ComputeDailyScoreParams = {
  userId: string;
  competitiveDate: Date;
  scoringVersionKey?: string;
};

/**
 * Ponto único de entrada da engine. Idempotente: reprocessar o mesmo (usuário, dia, versão)
 * apaga o `DailyScore` anterior (cascade cuida de componentes/ajustes) e recalcula do zero.
 */
export async function computeDailyScore({
  userId,
  competitiveDate,
  scoringVersionKey = DEFAULT_SCORING_VERSION_KEY,
}: ComputeDailyScoreParams) {
  const performance = await db.dailyPerformance.findUnique({
    where: { userId_competitiveDate: { userId, competitiveDate } },
  });

  if (!performance) {
    throw new Error(`DailyPerformance inexistente para ${userId} em ${competitiveDate.toISOString()}`);
  }

  if (performance.status !== "CLOSED" && performance.status !== "REPROCESSED") {
    logger.info("scoring.skip_not_closed", { userId, competitiveDate, status: performance.status });
    return null;
  }

  const { versionId, rules } = await loadRules(scoringVersionKey);
  const today = await buildDayInput(userId, performance.id);
  if (!today) return null;

  const recoveryMode = await loadActiveRecoveryMode(userId, competitiveDate);

  // baseline precisa vir antes de history: o proxy de "dias de excesso de Strain" usa
  // baseline.avgStrain (28d) como referência estável, nunca a média da própria janela curta.
  const baseline = await computeBaseline(userId, competitiveDate, 28);
  const [recentBaseline, longBaseline, history] = await Promise.all([
    computeBaseline(userId, competitiveDate, 14),
    computeBaseline(userId, competitiveDate, 84),
    computeHistoryContext(userId, competitiveDate, baseline.avgTrainingDayStrain),
  ]);

  await persistBaselineSnapshot(userId, baseline);

  const scorerInput: ScorerInput = {
    today,
    baseline,
    rules,
    recoveryMode,
    history,
    recentBaseline,
    longBaseline,
  };

  const sleep = scoreSleep(scorerInput);
  const recovery = scoreRecovery(scorerInput);
  const strain = scoreStrain(scorerInput);
  const consistency = scoreConsistency(scorerInput);
  const evolution = scoreEvolution(scorerInput);
  const habits = scoreHabits(scorerInput);

  const components: Array<{ category: ScoreCategory; result: ScorerResult }> = [
    { category: "SLEEP", result: sleep },
    { category: "RECOVERY", result: recovery },
    { category: "STRAIN", result: strain },
    { category: "CONSISTENCY", result: consistency },
    { category: "EVOLUTION", result: evolution },
    { category: "HABITS", result: habits },
  ];

  const totalPoints = Math.round(components.reduce((sum, c) => sum + c.result.pointsEarned, 0) * 100) / 100;

  const dailyScore = await db.$transaction(async (tx) => {
    const existing = await tx.dailyScore.findUnique({
      where: {
        userId_competitiveDate_scoringVersionId: {
          userId,
          competitiveDate,
          scoringVersionId: versionId,
        },
      },
    });
    if (existing) {
      await tx.dailyScore.delete({ where: { id: existing.id } });
    }

    const created = await tx.dailyScore.create({
      data: {
        userId,
        dailyPerformanceId: performance.id,
        competitiveDate,
        scoringVersionId: versionId,
        totalPoints,
        status: existing ? "REPROCESSED" : "FINAL",
      },
    });

    for (const { category, result } of components) {
      const component = await tx.scoreComponent.create({
        data: {
          dailyScoreId: created.id,
          category,
          pointsPossible: result.pointsPossible,
          pointsEarned: result.pointsEarned,
          inputValue: result.inputValue as never,
          normalizedValue: result.normalizedValue as never,
          metricUsed: result.metricUsed,
          baselineComparison: result.baselineComparison as never,
          explanation: result.explanation,
          recommendation: result.recommendation,
          ruleApplied: result.ruleApplied,
        },
      });

      for (const adjustment of result.adjustments) {
        await tx.scoreAdjustment.create({
          data: {
            scoreComponentId: component.id,
            type: adjustment.type,
            reason: adjustment.reason,
            points: adjustment.points,
            ruleKey: adjustment.ruleKey,
          },
        });
      }
    }

    await tx.strainRecommendation.upsert({
      where: { userId_competitiveDate: { userId, competitiveDate } },
      create: {
        userId,
        competitiveDate,
        min: strain.strainRecommendation.min,
        max: strain.strainRecommendation.max,
        rationale: strain.strainRecommendation.rationale as never,
      },
      update: {
        min: strain.strainRecommendation.min,
        max: strain.strainRecommendation.max,
        rationale: strain.strainRecommendation.rationale as never,
      },
    });

    return created;
  });

  logger.info("scoring.computed", { userId, competitiveDate, totalPoints });

  return dailyScore;
}
