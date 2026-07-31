import { ruleValue } from "./helpers";
import type { HistoryContext, RulesMap, ScoreAdjustmentResult } from "./types";

/**
 * Penalidade adicional por excesso repetido de Strain (SCORING.md §6) — separada da
 * penalidade por overage do próprio dia, que é calculada em `strain.scorer.ts`.
 */
export function computeOvertrainingPenalty(
  history: HistoryContext,
  rules: RulesMap,
): ScoreAdjustmentResult | null {
  const repeatedRule = ruleValue(rules, "strain.overage.repeated", {
    thresholdDays: 3,
    extraPenalty: -5,
  }) as { thresholdDays: number; extraPenalty: number };

  if (history.strainOverageDaysInLast7 < repeatedRule.thresholdDays) {
    return null;
  }

  return {
    type: "PENALTY",
    reason: `Excesso de Strain em ${history.strainOverageDaysInLast7} dos últimos 7 dias`,
    points: repeatedRule.extraPenalty,
    ruleKey: "strain.overage.repeated",
  };
}
