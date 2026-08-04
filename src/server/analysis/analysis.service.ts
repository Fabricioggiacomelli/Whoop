import { todayInAppTimezone } from "@/lib/timezone";

import { getDailyMetricsSeries, metricValues, sliceByDateRange } from "./metrics";
import { generateAllInsights, topInsightsByPolarity } from "./insights";
import { addDays, currentAndPreviousRange, dateKey, resolveAnalysisPeriod } from "./timeframes";
import { mean, percentChange, zScore } from "./stats";
import type { DailyMetric, Insight } from "./types";

const BASELINE_WINDOW_DAYS = 60;

export type MetricComparison = {
  key: string;
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  percentChange: number | null;
  /** true = quanto maior melhor (usado só pra decidir a cor do indicador na UI). */
  higherIsBetter: boolean;
};

export type CurrentStateItem = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  /** Desvio em relação ao seu próprio baseline de 60 dias, em desvios padrão. */
  zScore: number | null;
};

export type AnalysisViewModel = {
  periodKey: string;
  periodLabel: string;
  periodDays: number;
  hasEnoughData: boolean;
  totalDaysWithData: number;
  currentState: CurrentStateItem[];
  comparisons: MetricComparison[];
  trendSeries: {
    dateKey: string;
    recoveryScore: number | null;
    hrvMs: number | null;
    restingHeartRate: number | null;
    sleepPerformancePct: number | null;
    strain: number | null;
  }[];
  topInsights: Insight[];
  topOpportunities: Insight[];
  topPositives: Insight[];
};

const COMPARISON_METRICS: Array<{
  key: keyof DailyMetric;
  label: string;
  unit: string;
  higherIsBetter: boolean;
}> = [
  { key: "recoveryScore", label: "Recovery", unit: "", higherIsBetter: true },
  { key: "hrvMs", label: "HRV", unit: "ms", higherIsBetter: true },
  { key: "restingHeartRate", label: "FC de repouso", unit: "bpm", higherIsBetter: false },
  { key: "sleepPerformancePct", label: "Sleep Performance", unit: "%", higherIsBetter: true },
  { key: "strain", label: "Strain", unit: "", higherIsBetter: true },
];

/**
 * Monta o view-model completo da página /analysis. Não persiste nada — tudo computado
 * on-demand a partir de `DailyPerformance`/`WhoopCycle`/`JournalAnswer` (ver stats.ts,
 * metrics.ts, habits.ts, insights.ts). Uma única leitura em lote cobre período atual,
 * período anterior (comparação automática) e baseline de 60 dias (estado atual).
 */
export async function getAnalysisViewModel(userId: string, periodKeyParam: string | undefined): Promise<AnalysisViewModel> {
  const period = resolveAnalysisPeriod(periodKeyParam);
  const { current, previous } = currentAndPreviousRange(period.days);

  const today = todayInAppTimezone();
  const baselineFrom = addDays(today, -(BASELINE_WINDOW_DAYS - 1));
  const overallFrom = previous.from.getTime() < baselineFrom.getTime() ? previous.from : baselineFrom;

  const fullSeries = await getDailyMetricsSeries(userId, overallFrom, current.to);

  const currentSeries = sliceByDateRange(fullSeries, current.from, current.to);
  const previousSeries = sliceByDateRange(fullSeries, previous.from, previous.to);
  const baselineSeries = sliceByDateRange(fullSeries, baselineFrom, current.to);

  const comparisons: MetricComparison[] = COMPARISON_METRICS.map((m) => {
    const currentValue = mean(metricValues(currentSeries, m.key));
    const previousValue = mean(metricValues(previousSeries, m.key));
    return {
      key: String(m.key),
      label: m.label,
      unit: m.unit,
      current: currentValue,
      previous: previousValue,
      percentChange: percentChange(currentValue, previousValue),
      higherIsBetter: m.higherIsBetter,
    };
  });

  const lastDay = currentSeries[currentSeries.length - 1] ?? null;
  const currentState: CurrentStateItem[] = COMPARISON_METRICS.map((m) => {
    const value = lastDay ? lastDay[m.key] : null;
    const baselineValues = metricValues(baselineSeries, m.key);
    const z = typeof value === "number" && baselineValues.length >= 5 ? zScore(value, baselineValues) : null;
    return { key: String(m.key), label: m.label, unit: m.unit, value: typeof value === "number" ? value : null, zScore: z };
  });

  const insights = generateAllInsights(currentSeries);

  const trendSeries = currentSeries.map((d) => ({
    dateKey: d.dateKey,
    recoveryScore: d.recoveryScore,
    hrvMs: d.hrvMs,
    restingHeartRate: d.restingHeartRate,
    sleepPerformancePct: d.sleepPerformancePct,
    strain: d.trained ? d.strain : 0,
  }));

  return {
    periodKey: period.key,
    periodLabel: period.label,
    periodDays: period.days,
    hasEnoughData: currentSeries.length >= 5,
    totalDaysWithData: currentSeries.length,
    currentState,
    comparisons,
    trendSeries,
    topInsights: insights.slice(0, 3),
    topOpportunities: topInsightsByPolarity(insights, "negative", 3),
    topPositives: topInsightsByPolarity(insights, "positive", 3),
  };
}

export { dateKey };
