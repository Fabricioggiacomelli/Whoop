import { clamp, hasValue, round } from "./helpers";
import type { ScorerInput, ScorerResult } from "./types";

const POINTS_POSSIBLE = 10;

/**
 * Evolução pessoal (10 pts) — compara janela recente (curto prazo) contra a linha de base
 * de médio prazo do próprio usuário. Estritamente relativo ao indivíduo. Ver SCORING.md §8.
 */
export function scoreEvolution({ recentBaseline, longBaseline }: ScorerInput): ScorerResult {
  if (recentBaseline.sampleDays < 7 || longBaseline.sampleDays < 14) {
    return {
      pointsPossible: POINTS_POSSIBLE,
      pointsEarned: 0,
      explanation: "Histórico insuficiente para avaliar evolução ainda.",
      recommendation: "Continue sincronizando — a evolução é calculada com mais dados.",
      adjustments: [],
    };
  }

  const adjustments: ScorerResult["adjustments"] = [];

  if (hasValue(recentBaseline.avgHrvMs) && hasValue(longBaseline.avgHrvMs) && longBaseline.avgHrvMs > 0) {
    const ratio = recentBaseline.avgHrvMs / longBaseline.avgHrvMs;
    const points = round(clamp((ratio - 1) * 40, -4, 4), 1);
    adjustments.push({
      type: points >= 0 ? "BONUS" : "PENALTY",
      reason: `HRV recente ${round(recentBaseline.avgHrvMs, 0)}ms vs. médio prazo ${round(longBaseline.avgHrvMs, 0)}ms`,
      points,
      ruleKey: "evolution.hrv_trend",
    });
  }

  if (
    hasValue(recentBaseline.avgRestingHr) &&
    hasValue(longBaseline.avgRestingHr) &&
    recentBaseline.avgRestingHr > 0
  ) {
    const ratio = longBaseline.avgRestingHr / recentBaseline.avgRestingHr;
    const points = round(clamp((ratio - 1) * 40, -3, 3), 1);
    adjustments.push({
      type: points >= 0 ? "BONUS" : "PENALTY",
      reason: `FC repouso recente ${round(recentBaseline.avgRestingHr, 0)}bpm vs. médio prazo ${round(longBaseline.avgRestingHr, 0)}bpm`,
      points,
      ruleKey: "evolution.rhr_trend",
    });
  }

  if (
    hasValue(recentBaseline.avgSleepPerfPct) &&
    hasValue(longBaseline.avgSleepPerfPct) &&
    longBaseline.avgSleepPerfPct > 0
  ) {
    const ratio = recentBaseline.avgSleepPerfPct / longBaseline.avgSleepPerfPct;
    const points = round(clamp((ratio - 1) * 40, -3, 3), 1);
    adjustments.push({
      type: points >= 0 ? "BONUS" : "PENALTY",
      reason: `Sleep Performance recente vs. médio prazo`,
      points,
      ruleKey: "evolution.sleep_trend",
    });
  }

  const pointsEarned = round(
    adjustments.reduce((sum, a) => sum + a.points, 0),
    1,
  );

  return {
    pointsPossible: POINTS_POSSIBLE,
    pointsEarned,
    metricUsed: "trend_vs_baseline",
    baselineComparison: {
      recentAvgHrvMs: recentBaseline.avgHrvMs,
      longAvgHrvMs: longBaseline.avgHrvMs,
      recentAvgRestingHr: recentBaseline.avgRestingHr,
      longAvgRestingHr: longBaseline.avgRestingHr,
    },
    explanation: `Evolução: ${pointsEarned} de ${POINTS_POSSIBLE}`,
    recommendation:
      pointsEarned < 0
        ? "Indicadores recentes pioraram frente ao seu histórico — revise sono e carga."
        : "Sua tendência recente está igual ou melhor que seu histórico.",
    adjustments,
  };
}
