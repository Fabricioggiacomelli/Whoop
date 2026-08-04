import type { DailyMetric, Insight, InsightPolarity } from "./types";
import { computeHabitImpact, HABIT_IMPACT_CONFIG } from "./habits";
import { metricValues, nextDayValueByDateKey } from "./metrics";
import {
  cohensD,
  confidenceFromSampleSize,
  linearTrend,
  mean,
  pearsonCorrelation,
  percentile,
  winsorize,
} from "./stats";

/** true = "quanto maior, melhor" pra essa métrica — usado só pra decidir a polaridade do insight, nunca exibido. */
const HIGHER_IS_BETTER: Partial<Record<keyof DailyMetric, boolean>> = {
  recoveryScore: true,
  hrvMs: true,
  sleepPerformancePct: true,
  sleepEfficiencyPct: true,
  restingHeartRate: false,
};

const METRIC_LABELS: Partial<Record<keyof DailyMetric, string>> = {
  recoveryScore: "Recovery",
  hrvMs: "HRV",
  restingHeartRate: "FC de repouso",
  sleepPerformancePct: "Sleep Performance",
  sleepEfficiencyPct: "Eficiência do sono",
  strain: "Strain",
  timeInBedHours: "Horas na cama",
};

/** Amostra mínima por grupo e magnitude mínima de efeito pra um insight ser considerado
 *  digno de exibição — evita "inventar" padrão em ruído (ver spec: dataset sem relação
 *  real não deve gerar insight). */
const MIN_GROUP_N = 5;
const MIN_HABIT_EFFECT = 0.5; // Cohen's d — efeito médio/grande
const MIN_CORRELATION_EFFECT = 0.3;
const MIN_TREND_R2 = 0.25;
const MIN_TREND_N = 7;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function habitInsightId(habitKey: string, metricKey: string, lag: number): string {
  return `habit:${habitKey}:${metricKey}:lag${lag}`;
}

const HABIT_METRIC_PAIRS: Array<{ habitKey: string; metricKey: keyof DailyMetric; lag: 0 | 1 }> = [
  { habitKey: "alcohol", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "caffeine", metricKey: "sleepPerformancePct", lag: 1 },
  { habitKey: "water", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "food", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "sauna", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "mobility", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "stretching", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "physio", metricKey: "recoveryScore", lag: 1 },
  { habitKey: "meditation", metricKey: "recoveryScore", lag: 1 },
];

/** Itens 12/13/14 da spec — álcool×Recovery, cafeína×sono, e genericamente os demais hábitos ativos. */
export function generateHabitInsights(series: DailyMetric[]): Insight[] {
  const insights: Insight[] = [];

  for (const { habitKey, metricKey, lag } of HABIT_METRIC_PAIRS) {
    const config = HABIT_IMPACT_CONFIG[habitKey];
    const metricLabel = METRIC_LABELS[metricKey] ?? String(metricKey);
    const result = computeHabitImpact(series, habitKey, metricKey, metricLabel, lag);
    if (!result) continue;

    const smallerN = Math.min(result.exposedN, result.notExposedN);
    const confidence = confidenceFromSampleSize(smallerN);
    if (confidence === "insufficient" || Math.abs(result.effect) < MIN_HABIT_EFFECT) continue;

    const higherIsBetter = HIGHER_IS_BETTER[metricKey] ?? true;
    const diff = result.exposedMean - result.notExposedMean;
    const effectiveDiff = higherIsBetter ? diff : -diff;
    const polarity: InsightPolarity = effectiveDiff < 0 ? "negative" : "positive";

    const dayWord = lag === 1 ? "no dia seguinte" : "no mesmo dia";
    const direction = diff >= 0 ? "maior" : "menor";

    insights.push({
      id: habitInsightId(habitKey, String(metricKey), lag),
      category: "habit",
      polarity,
      title: `${config.label} parece se associar a ${metricLabel} ${dayWord}`,
      description: `Nos seus dados, ${result.exposedLabel} (n=${result.exposedN}) tiveram ${metricLabel} ${dayWord} em média ${round1(result.exposedMean)}, contra ${round1(result.notExposedMean)} em ${result.notExposedLabel} (n=${result.notExposedN}) — ${direction} em ${round1(Math.abs(diff))} pontos. Existe associação nos dias registrados; vale observar se o padrão se repete.`,
      confidence,
      sampleSize: result.exposedN + result.notExposedN,
      effectMagnitude: Math.abs(result.effect),
      evidence: [
        { label: result.exposedLabel, value: `média ${round1(result.exposedMean)} (n=${result.exposedN})` },
        { label: result.notExposedLabel, value: `média ${round1(result.notExposedMean)} (n=${result.notExposedN})` },
        { label: "Tamanho do efeito", value: round1(result.effect).toString() },
      ],
    });
  }

  return insights;
}

/** Item 15 — duração de sono × Recovery, usando divisão pela mediana das próprias noites do usuário. */
export function generateSleepDurationInsight(series: DailyMetric[]): Insight | null {
  const withBoth = series.filter((d) => d.timeInBedHours != null && d.recoveryScore != null);
  if (withBoth.length < MIN_GROUP_N * 2) return null;

  const durations = withBoth.map((d) => d.timeInBedHours!);
  const med = percentile(durations, 50);
  if (med == null) return null;

  const shorter = withBoth.filter((d) => d.timeInBedHours! < med).map((d) => d.recoveryScore!);
  const longer = withBoth.filter((d) => d.timeInBedHours! >= med).map((d) => d.recoveryScore!);
  if (shorter.length < MIN_GROUP_N || longer.length < MIN_GROUP_N) return null;

  const effect = cohensD(longer, shorter);
  if (effect == null || Math.abs(effect) < MIN_HABIT_EFFECT) return null;

  const meanShorter = mean(shorter)!;
  const meanLonger = mean(longer)!;
  const confidence = confidenceFromSampleSize(Math.min(shorter.length, longer.length));

  return {
    id: "sleep-duration:recoveryScore",
    category: "sleep",
    polarity: meanLonger > meanShorter ? "positive" : "negative",
    title: "Duração do sono parece se associar ao seu Recovery",
    description: `Noites de ${round1(med)}h ou mais tiveram Recovery médio de ${round1(meanLonger)} (n=${longer.length}), contra ${round1(meanShorter)} em noites mais curtas (n=${shorter.length}). Esse padrão apareceu nos seus dados; não há como afirmar causalidade só com essa comparação.`,
    confidence,
    sampleSize: withBoth.length,
    effectMagnitude: Math.abs(effect),
    evidence: [
      { label: `Noites ≥ ${round1(med)}h`, value: `Recovery médio ${round1(meanLonger)} (n=${longer.length})` },
      { label: `Noites < ${round1(med)}h`, value: `Recovery médio ${round1(meanShorter)} (n=${shorter.length})` },
    ],
  };
}

/** Item 16 — Strain de hoje × Recovery de amanhã (dose-resposta), via correlação de Pearson. */
export function generateStrainRecoveryInsight(series: DailyMetric[]): Insight | null {
  const nextRecovery = nextDayValueByDateKey(series, "recoveryScore");
  const pairs = series
    .filter((d) => d.strain != null && nextRecovery.has(d.dateKey))
    .map((d) => ({ strain: d.strain!, recovery: nextRecovery.get(d.dateKey)! }));

  if (pairs.length < MIN_GROUP_N * 2) return null;

  const r = pearsonCorrelation(
    pairs.map((p) => p.strain),
    pairs.map((p) => p.recovery),
  );
  if (r == null || Math.abs(r) < MIN_CORRELATION_EFFECT) return null;

  const confidence = confidenceFromSampleSize(pairs.length);

  return {
    id: "strain:next-day-recovery",
    category: "strain",
    polarity: r < 0 ? "negative" : "positive",
    title: "Strain do dia parece se associar ao Recovery do dia seguinte",
    description: `Nos seus últimos ${pairs.length} dias com dado completo, dias de Strain mais ${r < 0 ? "alto tenderam a vir seguidos de Recovery mais baixo" : "alto tenderam a vir seguidos de Recovery mais alto"} no dia seguinte. É uma associação observada nos seus dados, não uma regra fixa.`,
    confidence,
    sampleSize: pairs.length,
    effectMagnitude: Math.abs(r),
    evidence: [{ label: "Correlação (Strain hoje × Recovery amanhã)", value: round1(r).toString() }],
  };
}

const TREND_METRICS: Array<keyof DailyMetric> = ["recoveryScore", "hrvMs", "restingHeartRate", "sleepPerformancePct"];

/** Tendências de curto prazo por métrica — regressão linear sobre o período selecionado. */
export function generateTrendInsights(series: DailyMetric[]): Insight[] {
  const insights: Insight[] = [];

  for (const metricKey of TREND_METRICS) {
    const rawValues = metricValues(series, metricKey);
    if (rawValues.length < MIN_TREND_N) continue;

    // Winsoriza pra um outlier isolado (ex: um dia de WHOOP com leitura ruim) não fabricar
    // uma tendência que não existe — nunca descarta pontos, só limita a influência deles.
    const values = winsorize(rawValues, 10, 90);
    const trend = linearTrend(values);
    if (!trend || trend.direction === "stable" || trend.r2 < MIN_TREND_R2) continue;

    const higherIsBetter = HIGHER_IS_BETTER[metricKey] ?? true;
    const metricLabel = METRIC_LABELS[metricKey] ?? String(metricKey);
    const goingUp = trend.direction === "up";
    const polarity: InsightPolarity = (goingUp && higherIsBetter) || (!goingUp && !higherIsBetter) ? "positive" : "negative";

    insights.push({
      id: `trend:${String(metricKey)}`,
      category: polarity === "positive" ? "positive_trend" : "negative_trend",
      polarity,
      title: `${metricLabel} está em tendência de ${goingUp ? "alta" : "queda"}`,
      description: `Nos últimos ${values.length} dias com dado, seu ${metricLabel} mostra uma tendência de ${goingUp ? "alta" : "queda"}. Esse padrão apareceu no período analisado — vale acompanhar se ele se mantém.`,
      confidence: confidenceFromSampleSize(values.length),
      sampleSize: values.length,
      effectMagnitude: trend.r2,
      evidence: [
        { label: "Direção", value: goingUp ? "alta" : "queda" },
        { label: "Ajuste da tendência (R²)", value: round1(trend.r2).toString() },
        { label: "Dias analisados", value: values.length.toString() },
      ],
    });
  }

  return insights;
}

/** Item "melhores vs piores 20% dos dias" — compara os dias de Recovery mais alto com os de Recovery mais baixo. */
export function generateBestWorstInsight(series: DailyMetric[]): Insight | null {
  const withRecovery = series.filter((d) => d.recoveryScore != null);
  if (withRecovery.length < 10) return null;

  const scores = withRecovery.map((d) => d.recoveryScore!);
  const p20 = percentile(scores, 20);
  const p80 = percentile(scores, 80);
  if (p20 == null || p80 == null || p20 === p80) return null;

  const worst = withRecovery.filter((d) => d.recoveryScore! <= p20);
  const best = withRecovery.filter((d) => d.recoveryScore! >= p80);
  if (worst.length < 3 || best.length < 3) return null;

  const bestSleep = mean(best.map((d) => d.sleepPerformancePct).filter((v): v is number => v != null));
  const worstSleep = mean(worst.map((d) => d.sleepPerformancePct).filter((v): v is number => v != null));
  const bestBedtime = mean(best.map((d) => d.bedTimeMinutesOfDay).filter((v): v is number => v != null));
  const worstBedtime = mean(worst.map((d) => d.bedTimeMinutesOfDay).filter((v): v is number => v != null));

  const parts: string[] = [];
  if (bestSleep != null && worstSleep != null) {
    parts.push(`Sleep Performance médio de ${round1(bestSleep)} nos melhores dias contra ${round1(worstSleep)} nos piores`);
  }
  if (bestBedtime != null && worstBedtime != null && Math.abs(bestBedtime - worstBedtime) >= 20) {
    const fmt = (m: number) => `${Math.floor(m / 60) % 24}h${String(Math.round(m % 60)).padStart(2, "0")}`;
    parts.push(`horário de dormir médio de ${fmt(bestBedtime)} nos melhores dias contra ${fmt(worstBedtime)} nos piores`);
  }
  if (parts.length === 0) return null;

  return {
    id: "best-vs-worst-20pct",
    category: "recovery",
    polarity: "neutral",
    title: "O que diferencia seus melhores dias dos seus piores",
    description: `Comparando os ${best.length} dias de Recovery mais alto com os ${worst.length} de Recovery mais baixo do período: ${parts.join("; ")}. São diferenças observadas entre os dois grupos, não uma fórmula garantida.`,
    confidence: confidenceFromSampleSize(Math.min(best.length, worst.length)),
    sampleSize: best.length + worst.length,
    effectMagnitude: 1,
    evidence: [
      { label: `Melhores ${best.length} dias (Recovery ≥ ${round1(p80)})`, value: parts[0] ?? "" },
      { label: `Piores ${worst.length} dias (Recovery ≤ ${round1(p20)})`, value: "" },
    ],
  };
}

export function generateAllInsights(series: DailyMetric[]): Insight[] {
  const insights: Insight[] = [
    ...generateHabitInsights(series),
    ...generateTrendInsights(series),
  ];

  const sleepDuration = generateSleepDurationInsight(series);
  if (sleepDuration) insights.push(sleepDuration);

  const strainRecovery = generateStrainRecoveryInsight(series);
  if (strainRecovery) insights.push(strainRecovery);

  const bestWorst = generateBestWorstInsight(series);
  if (bestWorst) insights.push(bestWorst);

  return insights.sort((a, b) => {
    const confidenceRank = { good: 4, moderate: 3, low: 2, exploratory: 1, insufficient: 0 };
    const rankDiff = confidenceRank[b.confidence] - confidenceRank[a.confidence];
    if (rankDiff !== 0) return rankDiff;
    return b.effectMagnitude - a.effectMagnitude;
  });
}

export function topInsightsByPolarity(
  insights: Insight[],
  polarity: InsightPolarity,
  limit = 3,
): Insight[] {
  return insights.filter((i) => i.polarity === polarity).slice(0, limit);
}
