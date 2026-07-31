import type { DayInput, ScoreAdjustmentResult } from "./types";

/**
 * Falta de dados por responsabilidade do usuário (esqueceu a pulseira ou não respondeu o
 * Journal) — nunca aplicada por falha técnica (esse caso nem chega a ser calculado, ver
 * DailyPerformance.status). Ver SCORING.md §7 e §17.
 */
export function computeMissingDataPenalty(today: DayInput): ScoreAdjustmentResult | null {
  const missingWhoop = !today.sleep || !today.recovery;
  const missingJournal = today.journalAnswers === null;

  if (!missingWhoop && !missingJournal) return null;

  if (missingWhoop) {
    return {
      type: "PENALTY",
      reason: "Sem dados da WHOOP no dia (pulseira não usada)",
      points: -10,
      ruleKey: "missing_data.user_fault",
    };
  }

  return {
    type: "PENALTY",
    reason: "Journal não respondido",
    points: -4,
    ruleKey: "missing_data.user_fault",
  };
}
