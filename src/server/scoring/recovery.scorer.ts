import { clamp, hasValue, round } from "./helpers";
import type { ScorerInput, ScorerResult } from "./types";

const POINTS_POSSIBLE = 20;

/**
 * Recovery (20 pts) — nunca premia Recovery alta isolada; tudo é relativo à própria linha
 * de base (HRV/FC/Recovery absolutos nunca são fator principal). Ver SCORING.md §5.
 */
export function scoreRecovery({ today, baseline }: ScorerInput): ScorerResult {
  if (!today.recovery) {
    return {
      pointsPossible: POINTS_POSSIBLE,
      pointsEarned: 0,
      metricUsed: "recoveryScore",
      explanation: "Sem dados de Recovery da WHOOP para este dia.",
      recommendation: "Verifique a conexão da pulseira.",
      adjustments: [],
    };
  }

  const recoveryScore = today.recovery.recoveryScore ?? 0;
  const hrv = today.recovery.hrvMs;
  const rhr = today.recovery.restingHeartRate;

  const adjustments: ScorerResult["adjustments"] = [];

  const recoveryRel = hasValue(baseline.avgRecoveryScore)
    ? clamp(5 + (recoveryScore - baseline.avgRecoveryScore) / 10, 0, 10)
    : clamp(recoveryScore / 100, 0, 1) * 10;
  adjustments.push({
    type: "BONUS",
    reason: hasValue(baseline.avgRecoveryScore)
      ? `Recovery ${round(recoveryScore, 0)} vs. sua média de ${round(baseline.avgRecoveryScore, 0)}`
      : `Recovery ${round(recoveryScore, 0)} (sem baseline ainda)`,
    points: round(recoveryRel, 1),
    ruleKey: "recovery.relative_score",
  });

  const hrvRel =
    hasValue(hrv) && hasValue(baseline.avgHrvMs) && baseline.avgHrvMs > 0
      ? clamp(2.5 + (hrv / baseline.avgHrvMs - 1) * 10, 0, 5)
      : 2.5;
  adjustments.push({
    type: "BONUS",
    reason:
      hasValue(hrv) && hasValue(baseline.avgHrvMs)
        ? `HRV ${round(hrv, 0)}ms relativo à sua média (${round(baseline.avgHrvMs, 0)}ms)`
        : "HRV — sem baseline suficiente ainda",
    points: round(hrvRel, 1),
    ruleKey: "recovery.hrv_relative",
  });

  const rhrRel =
    hasValue(rhr) && hasValue(baseline.avgRestingHr) && rhr > 0
      ? clamp(1.5 + (baseline.avgRestingHr / rhr - 1) * 15, 0, 3)
      : 1.5;
  adjustments.push({
    type: "BONUS",
    reason:
      hasValue(rhr) && hasValue(baseline.avgRestingHr)
        ? `FC repouso ${round(rhr, 0)}bpm relativa à sua média (${round(baseline.avgRestingHr, 0)}bpm)`
        : "FC repouso — sem baseline suficiente ainda",
    points: round(rhrRel, 1),
    ruleKey: "recovery.rhr_relative",
  });

  const loadRatio =
    hasValue(baseline.acuteLoad7d) && hasValue(baseline.chronicLoad28d) && baseline.chronicLoad28d > 0
      ? baseline.acuteLoad7d / baseline.chronicLoad28d
      : 1;
  const trendPoints = round(clamp(1 - (loadRatio - 1) * 4, -2, 2), 1);
  adjustments.push({
    type: trendPoints >= 0 ? "BONUS" : "PENALTY",
    reason:
      loadRatio > 1.05
        ? "Carga aguda subindo acima da crônica — tendência de fadiga"
        : "Tendência de carga estável",
    points: trendPoints,
    ruleKey: "recovery.trend",
  });

  const pointsEarned = round(
    adjustments.reduce((sum, a) => sum + a.points, 0),
    1,
  );

  return {
    pointsPossible: POINTS_POSSIBLE,
    pointsEarned,
    inputValue: { recoveryScore, hrvMs: hrv, restingHeartRate: rhr },
    metricUsed: "recoveryScore",
    baselineComparison: {
      recoveryScore,
      baselineAvgRecoveryScore: hasValue(baseline.avgRecoveryScore) ? baseline.avgRecoveryScore : null,
      hrvMs: hasValue(hrv) ? hrv : null,
      baselineAvgHrvMs: hasValue(baseline.avgHrvMs) ? baseline.avgHrvMs : null,
    },
    explanation: `Recovery: ${pointsEarned} de ${POINTS_POSSIBLE}`,
    recommendation:
      recoveryScore < 34
        ? "Recovery baixa — priorize descanso, sono e atividade leve hoje."
        : "Recovery em bom nível — decisão de treino fica a seu critério.",
    adjustments,
  };
}
