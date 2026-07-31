import { clamp, hasValue, ruleValue, round } from "./helpers";
import { computeOvertrainingPenalty } from "./overtraining.penalty";
import { getRecoveryModeAdjustment } from "./recoveryModeAdjustment";
import type { RecoveryModeInfo, RulesMap, ScorerInput, ScorerResult, Baseline } from "./types";

const POINTS_POSSIBLE = 25;

export type StrainRecommendation = {
  min: number;
  max: number;
  rationale: Record<string, unknown>;
};

/** Calculada antes/independente do treino em si — nunca lida da WHOOP. Ver WHOOP_INTEGRATION.md §1. */
export function computeStrainRecommendation(
  baseline: Baseline,
  recoveryScoreToday: number | null,
  recoveryMode: RecoveryModeInfo,
): StrainRecommendation {
  const baseMax =
    hasValue(baseline.avgTrainingDayStrain) && baseline.avgTrainingDayStrain > 0
      ? baseline.avgTrainingDayStrain * 1.15
      : 12;

  const bandMultiplier = !hasValue(recoveryScoreToday)
    ? 1
    : recoveryScoreToday >= 67
      ? 1.15
      : recoveryScoreToday >= 34
        ? 1.0
        : 0.75;

  const { strainCeilingMultiplier } = getRecoveryModeAdjustment(recoveryMode);

  const max = round(clamp(baseMax * bandMultiplier * strainCeilingMultiplier, 4, 21), 1);
  const min = round(clamp(max * 0.55, 2, max), 1);

  return {
    min,
    max,
    rationale: {
      baseMax: round(baseMax, 1),
      bandMultiplier,
      recoveryModeMultiplier: strainCeilingMultiplier,
      recoveryModeType: recoveryMode?.type ?? null,
    },
  };
}

function pickOverageTier(overagePct: number, rules: RulesMap) {
  const tolerance = ruleValue(rules, "strain.overage.tolerance", { maxPct: 10, penalty: 0 }) as {
    maxPct: number;
    penalty: number;
  };
  const tier1 = ruleValue(rules, "strain.overage.tier1", { minPct: 10, maxPct: 20, penalty: -3 }) as {
    minPct: number;
    maxPct: number;
    penalty: number;
  };
  const tier2 = ruleValue(rules, "strain.overage.tier2", { minPct: 20, maxPct: 35, penalty: -7 }) as {
    minPct: number;
    maxPct: number;
    penalty: number;
  };
  const tier3 = ruleValue(rules, "strain.overage.tier3", { minPct: 35, penalty: -12 }) as {
    minPct: number;
    penalty: number;
  };

  if (overagePct <= tolerance.maxPct) return { penalty: 0, ruleKey: "strain.overage.tolerance" as const };
  if (overagePct <= tier1.maxPct) return { penalty: tier1.penalty, ruleKey: "strain.overage.tier1" as const };
  if (overagePct <= tier2.maxPct) return { penalty: tier2.penalty, ruleKey: "strain.overage.tier2" as const };
  return { penalty: tier3.penalty, ruleKey: "strain.overage.tier3" as const };
}

/**
 * Treino e Strain (25 pts) — nunca obriga treino diário; descanso inteligente pontua tão
 * bem quanto treino dentro da faixa. Ver SCORING.md §6.
 */
export function scoreStrain(input: ScorerInput): ScorerResult & { strainRecommendation: StrainRecommendation } {
  const { today, baseline, rules, recoveryMode, history } = input;

  const recommendation = computeStrainRecommendation(
    baseline,
    today.recovery?.recoveryScore ?? null,
    recoveryMode,
  );

  const adjustments: ScorerResult["adjustments"] = [];
  const strain = today.strain ?? 0;

  if (!today.trained) {
    const recoveryLow = hasValue(today.recovery?.recoveryScore) && today.recovery!.recoveryScore! < 34;
    adjustments.push({
      type: "BONUS",
      reason: recoveryLow
        ? "Descanso inteligente em dia de Recovery baixa"
        : "Dia sem treino — treinar não é obrigatório para nota máxima",
      points: POINTS_POSSIBLE,
      ruleKey: "strain.rest_day",
    });
  } else {
    const overagePct = ((strain - recommendation.max) / recommendation.max) * 100;
    adjustments.push({
      type: "BONUS",
      reason: `Treinou com Strain ${round(strain, 1)} (faixa recomendada: ${recommendation.min}–${recommendation.max})`,
      points: POINTS_POSSIBLE,
      ruleKey: "strain.base",
    });

    if (overagePct > 0) {
      const tier = pickOverageTier(overagePct, rules);
      if (tier.penalty !== 0) {
        adjustments.push({
          type: "PENALTY",
          reason: `Strain ${round(overagePct, 0)}% acima da faixa recomendada`,
          points: tier.penalty,
          ruleKey: tier.ruleKey,
        });
      }
    }
  }

  const overtraining = computeOvertrainingPenalty(history, rules);
  if (overtraining) adjustments.push(overtraining);

  const pointsEarned = round(
    adjustments.reduce((sum, a) => sum + a.points, 0),
    1,
  );

  return {
    pointsPossible: POINTS_POSSIBLE,
    pointsEarned,
    inputValue: { strain, trained: today.trained },
    metricUsed: "strain",
    baselineComparison: {
      strain,
      recommendedMin: recommendation.min,
      recommendedMax: recommendation.max,
      baselineAvgStrain: hasValue(baseline.avgStrain) ? baseline.avgStrain : null,
    },
    explanation: `Treino e Strain: ${pointsEarned} de ${POINTS_POSSIBLE}`,
    recommendation:
      today.trained && strain > recommendation.max
        ? "Você passou da faixa recomendada — considere reduzir a carga nos próximos dias."
        : `Faixa recomendada de hoje: ${recommendation.min}–${recommendation.max} de Strain.`,
    adjustments,
    strainRecommendation: recommendation,
  };
}
