/**
 * Funções estatísticas puras usadas pela Análise. Sem I/O, sem dependência de Prisma —
 * o que torna possível testar com datasets sintéticos de resultado conhecido (ver
 * tests/unit/analysis/stats.test.ts).
 */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Desvio padrão amostral (n-1). Retorna null com menos de 2 pontos — não faz sentido com 1. */
export function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Percentil por interpolação linear (método comum, mesmo usado por numpy "linear"). */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/** Coeficiente de variação — dispersão relativa à média, útil pra comparar métricas de escalas diferentes. */
export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values);
  const sd = stddev(values);
  if (m == null || sd == null || m === 0) return null;
  return sd / m;
}

/** Média móvel simples dos últimos `window` pontos (inclui o ponto atual). */
export function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return mean(slice);
  });
}

/** EWMA — alpha padrão 2/(N+1), mais peso pros pontos recentes que a média móvel simples. */
export function ewma(values: number[], windowForAlpha: number): (number | null)[] {
  if (values.length === 0) return [];
  const alpha = 2 / (windowForAlpha + 1);
  const result: (number | null)[] = [];
  let prev: number | null = null;
  for (const v of values) {
    prev = prev == null ? v : alpha * v + (1 - alpha) * prev;
    result.push(prev);
  }
  return result;
}

/** Quanto `value` se desvia da média do baseline, em unidades de desvio padrão. */
export function zScore(value: number, baselineValues: number[]): number | null {
  const m = mean(baselineValues);
  const sd = stddev(baselineValues);
  if (m == null || sd == null || sd === 0) return null;
  return (value - m) / sd;
}

/** % de variação entre dois valores (ex: período atual vs período anterior). */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type TrendDirection = "up" | "down" | "stable";

export type TrendResult = {
  direction: TrendDirection;
  /** Inclinação da regressão linear (unidade da métrica por dia). */
  slopePerDay: number;
  /** R² da regressão — quão bem a reta explica a variação dos pontos (0 a 1). */
  r2: number;
};

/**
 * Regressão linear simples (índice do dia × valor) pra detectar tendência. Classifica
 * "stable" quando a variação total projetada no período é pequena (<3% da média) — evita
 * rotular ruído como tendência.
 */
export function linearTrend(values: number[]): TrendResult | null {
  const n = values.length;
  if (n < 3) return null;

  const xs = values.map((_, i) => i);
  const xMean = mean(xs)!;
  const yMean = mean(values)!;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  const projectedChange = slope * (n - 1);
  const relativeChange = yMean !== 0 ? Math.abs(projectedChange / yMean) : 0;

  const direction: TrendDirection = relativeChange < 0.03 ? "stable" : slope > 0 ? "up" : "down";

  return { direction, slopePerDay: slope, r2 };
}

/** Correlação de Pearson entre duas séries pareadas (mesmo índice = mesmo dia). */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const xMean = mean(xs)!;
  const yMean = mean(ys)!;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    denX += dx ** 2;
    denY += dy ** 2;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

/** Cohen's d (desvio combinado) — tamanho de efeito entre dois grupos independentes. */
export function cohensD(groupA: number[], groupB: number[]): number | null {
  if (groupA.length < 2 || groupB.length < 2) return null;
  const mA = mean(groupA)!;
  const mB = mean(groupB)!;
  const sdA = stddev(groupA)!;
  const sdB = stddev(groupB)!;
  const nA = groupA.length;
  const nB = groupB.length;
  const pooledVariance = ((nA - 1) * sdA ** 2 + (nB - 1) * sdB ** 2) / (nA + nB - 2);
  const pooledSd = Math.sqrt(pooledVariance);
  if (pooledSd === 0) return null;
  return (mA - mB) / pooledSd;
}

export type ConfidenceLevel = "insufficient" | "exploratory" | "low" | "moderate" | "good";

/**
 * Confiança baseada só em tamanho de amostra — ver AGENTS/spec: <5 não calcula, 5-9
 * exploratório, 10-19 baixa, 20-39 moderada, 40+ boa. Combinar com magnitude do efeito
 * fora desta função (cada chamador decide o que fazer com "insufficient").
 */
export function confidenceFromSampleSize(n: number): ConfidenceLevel {
  if (n < 5) return "insufficient";
  if (n < 10) return "exploratory";
  if (n < 20) return "low";
  if (n < 40) return "moderate";
  return "good";
}

/** Winsoriza valores fora de [p_low, p_high] pros limites do percentil — nunca descarta pontos. */
export function winsorize(values: number[], lowPercentile = 5, highPercentile = 95): number[] {
  const lo = percentile(values, lowPercentile);
  const hi = percentile(values, highPercentile);
  if (lo == null || hi == null) return values;
  return values.map((v) => Math.min(hi, Math.max(lo, v)));
}
