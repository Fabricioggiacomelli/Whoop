import { clamp, round } from "./helpers";
import { computeMissingDataPenalty } from "./missingData.penalty";
import { getRecoveryModeAdjustment } from "./recoveryModeAdjustment";
import type { ScorerInput, ScorerResult } from "./types";

const POINTS_POSSIBLE = 15;

/**
 * Consistência (15 pts) — quebrar a sequência custa o bônus de sequência, nunca uma
 * penalidade própria adicional; falta de dados é penalizada à parte. Ver SCORING.md §7.
 */
export function scoreConsistency({ today, history, recoveryMode }: ScorerInput): ScorerResult {
  const adjustments: ScorerResult["adjustments"] = [];

  const streakPoints = round(clamp(history.consecutiveDaysWithData / 14, 0, 1) * 8, 1);
  adjustments.push({
    type: "BONUS",
    reason: `Sequência de ${history.consecutiveDaysWithData} dia(s) com dados completos`,
    points: streakPoints,
    ruleKey: "consistency.streak",
  });

  const { treatRestAsGoodConsistency, note } = getRecoveryModeAdjustment(recoveryMode);
  const regularityPoints = round(history.bedtimeConsistency * 7, 1);
  adjustments.push({
    type: "BONUS",
    reason: treatRestAsGoodConsistency
      ? `Regularidade de sono/rotina (${note ?? "modo recuperação"})`
      : "Regularidade de sono e treino",
    points: regularityPoints,
    ruleKey: "consistency.regularity",
  });

  const missingData = computeMissingDataPenalty(today);
  if (missingData) adjustments.push(missingData);

  const pointsEarned = round(
    adjustments.reduce((sum, a) => sum + a.points, 0),
    1,
  );

  return {
    pointsPossible: POINTS_POSSIBLE,
    pointsEarned,
    metricUsed: "consecutiveDaysWithData",
    baselineComparison: {
      consecutiveDaysWithData: history.consecutiveDaysWithData,
      bedtimeConsistency: history.bedtimeConsistency,
    },
    explanation: `Consistência: ${pointsEarned} de ${POINTS_POSSIBLE}`,
    recommendation:
      history.consecutiveDaysWithData < 3
        ? "Reconstrua sua sequência: use a pulseira e responda o Journal todos os dias."
        : "Sequência sólida — continue assim.",
    adjustments,
  };
}
