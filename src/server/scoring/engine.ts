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

export async function loadRules(scoringVersionKey: string): Promise<{ versionId: string; rules: RulesMap }> {
  const version = await db.scoringVersion.findUniqueOrThrow({
    where: { key: scoringVersionKey },
    include: { rules: true },
  });

  const rules = new Map(version.rules.map((r) => [r.key, r.value]));
  return { versionId: version.id, rules };
}

export async function buildDayInput(userId: string, dailyPerformanceId: string): Promise<DayInput | null> {
  const performance = await db.dailyPerformance.findUniqueOrThrow({
    where: { id: dailyPerformanceId },
  });

  const cycle = performance.cycleId
    ? await db.whoopCycle.findUnique({
        where: { id: performance.cycleId },
        include: { sleeps: true, recovery: true },
      })
    : null;

  // Um ciclo pode ter mais de um registro de sono (soneca + sono principal) — só o sono
  // principal (isNap: false) entra na pontuação do dia.
  const mainSleep = cycle?.sleeps.find((s) => !s.isNap) ?? null;

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
    sleep: mainSleep
      ? {
          sleepPerformancePct: mainSleep.sleepPerformancePct != null ? Number(mainSleep.sleepPerformancePct) : null,
          sleepEfficiencyPct: mainSleep.sleepEfficiencyPct != null ? Number(mainSleep.sleepEfficiencyPct) : null,
          sleepNeedMinutes: mainSleep.sleepNeedMinutes,
          timeInBedMinutes: mainSleep.timeInBedMinutes,
          remMinutes: mainSleep.remMinutes,
          deepMinutes: mainSleep.deepMinutes,
          disturbanceCount: mainSleep.disturbanceCount,
          sleepDebtMinutes: mainSleep.sleepDebtMinutes,
          startedAt: mainSleep.startedAt,
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

export async function loadActiveRecoveryMode(userId: string, date: Date): Promise<RecoveryModeInfo> {
  const mode = await db.recoveryMode.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "EXTENDED"] },
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

export type ScorePreview = { totalPoints: number };

/**
 * Mesma fórmula do dia fechado, mas sem persistir nada (nenhum DailyScore/ScoreComponent
 * criado) — usada pra mostrar um "placar parcial" de hoje, antes do dia realmente fechar.
 * Funciona com o strain ainda subindo: o número muda a cada nova consulta até o dia fechar
 * de verdade, é só uma prévia, não uma fonte de verdade.
 */
export async function previewDailyScore(
  userId: string,
  competitiveDate: Date,
  scoringVersionKey = DEFAULT_SCORING_VERSION_KEY,
): Promise<ScorePreview | null> {
  const performance = await db.dailyPerformance.findUnique({
    where: { userId_competitiveDate: { userId, competitiveDate } },
  });
  if (!performance) return null;

  const { rules } = await loadRules(scoringVersionKey);
  const today = await buildDayInput(userId, performance.id);
  if (!today) return null;

  const recoveryMode = await loadActiveRecoveryMode(userId, competitiveDate);

  const baseline = await computeBaseline(userId, competitiveDate, 28);
  const [recentBaseline, longBaseline, history] = await Promise.all([
    computeBaseline(userId, competitiveDate, 14),
    computeBaseline(userId, competitiveDate, 84),
    computeHistoryContext(userId, competitiveDate, baseline.avgTrainingDayStrain),
  ]);

  const scorerInput: ScorerInput = { today, baseline, rules, recoveryMode, history, recentBaseline, longBaseline };

  const totalPoints =
    Math.round(
      (scoreSleep(scorerInput).pointsEarned +
        scoreRecovery(scorerInput).pointsEarned +
        scoreStrain(scorerInput).pointsEarned +
        scoreConsistency(scorerInput).pointsEarned +
        scoreEvolution(scorerInput).pointsEarned +
        scoreHabits(scorerInput).pointsEarned) *
        100,
    ) / 100;

  return { totalPoints };
}
