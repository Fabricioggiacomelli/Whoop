import { clamp, hasValue, round } from "./helpers";
import type { ScorerInput, ScorerResult } from "./types";

const POINTS_POSSIBLE = 25;

/**
 * Sono (25 pts) — nunca premia duração absoluta isolada. Ver SCORING.md §4.
 * Cada critério vira uma linha de `ScoreAdjustment` (bônus ou penalidade); a soma é o total.
 */
export function scoreSleep({ today, baseline, history }: ScorerInput): ScorerResult {
  if (!today.sleep) {
    return {
      pointsPossible: POINTS_POSSIBLE,
      pointsEarned: 0,
      metricUsed: "sleepPerformancePct",
      explanation: "Sem dados de sono da WHOOP para este dia.",
      recommendation: "Verifique a conexão da pulseira.",
      adjustments: [],
    };
  }

  const sp = today.sleep.sleepPerformancePct ?? 0;
  const efficiency = today.sleep.sleepEfficiencyPct ?? 0;
  const debtMin = today.sleep.sleepDebtMinutes ?? 0;
  const rem = today.sleep.remMinutes ?? 0;
  const deep = today.sleep.deepMinutes ?? 0;
  const timeInBed = today.sleep.timeInBedMinutes ?? 0;
  const disturbances = today.sleep.disturbanceCount ?? 0;

  const adjustments: ScorerResult["adjustments"] = [];

  const perfPoints = round(clamp(sp / 100, 0, 1) * 12, 1);
  adjustments.push({
    type: "BONUS",
    reason: `Sleep Performance ${round(sp, 0)}%`,
    points: perfPoints,
    ruleKey: "sleep.performance",
  });

  const consistencyPoints = round(history.bedtimeConsistency * 4, 1);
  adjustments.push({
    type: "BONUS",
    reason: "Consistência de horário de dormir",
    points: consistencyPoints,
    ruleKey: "sleep.consistency",
  });

  const efficiencyPoints = round(clamp(efficiency / 100, 0, 1) * 3, 1);
  adjustments.push({
    type: "BONUS",
    reason: `Eficiência do sono ${round(efficiency, 0)}%`,
    points: efficiencyPoints,
    ruleKey: "sleep.efficiency",
  });

  if (timeInBed > 0) {
    const remDeepRatio = (rem + deep) / timeInBed;
    const remDeepPoints = round(clamp(3 - Math.abs(remDeepRatio - 0.4) * 15, 0, 3), 1);
    adjustments.push({
      type: "BONUS",
      reason: `Proporção REM/profundo ${round(remDeepRatio * 100, 0)}%`,
      points: remDeepPoints,
      ruleKey: "sleep.rem_deep_ratio",
    });
  }

  if (debtMin > 30) {
    const debtPenalty = -round(clamp(debtMin / 300, 0, 1) * 3, 1);
    adjustments.push({
      type: "PENALTY",
      reason: `Dívida de sono acumulada (${Math.round(debtMin)} min)`,
      points: debtPenalty,
      ruleKey: "sleep.debt",
    });
  }

  const disturbancePoints = round(clamp(2 - (disturbances - 2) * 0.5, -2, 2), 1);
  if (disturbancePoints !== 0) {
    adjustments.push({
      type: disturbancePoints > 0 ? "BONUS" : "PENALTY",
      reason:
        disturbancePoints > 0
          ? `Poucas interrupções (${disturbances})`
          : `Muitas interrupções (${disturbances})`,
      points: disturbancePoints,
      ruleKey: "sleep.disturbances",
    });
  }

  if (today.journalAnswers?.caffeine === "AT_NIGHT") {
    adjustments.push({
      type: "PENALTY",
      reason: "Cafeína à noite",
      points: -1.5,
      ruleKey: "habits.caffeine_at_night",
    });
  }

  const pointsEarned = round(
    adjustments.reduce((sum, a) => sum + a.points, 0),
    1,
  );

  const baselineComparison: Record<string, number | null> = {
    sleepPerformancePct: sp,
    baselineAvgSleepPerfPct: hasValue(baseline.avgSleepPerfPct) ? baseline.avgSleepPerfPct : null,
  };

  const recommendation =
    pointsEarned < POINTS_POSSIBLE * 0.6
      ? "Priorize horário de dormir regular e reduza estímulos à noite."
      : "Mantenha a rotina de sono — está funcionando.";

  return {
    pointsPossible: POINTS_POSSIBLE,
    pointsEarned,
    inputValue: { sleepPerformancePct: sp, sleepEfficiencyPct: efficiency, sleepDebtMinutes: debtMin },
    normalizedValue: { perfRatio: round(sp / 100, 2) },
    metricUsed: "sleepPerformancePct",
    baselineComparison,
    explanation: `Sono: ${pointsEarned} de ${POINTS_POSSIBLE}`,
    recommendation,
    adjustments,
  };
}
