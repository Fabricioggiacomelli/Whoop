import type { DailyMetric } from "./types";
import { nextDayValueByDateKey } from "./metrics";
import { cohensD, mean } from "./stats";

/**
 * Classificador de exposição por hábito — cobre os 9 hábitos hoje ativos no seed
 * (`prisma/seed.ts`: água, alimentação, álcool, cafeína, sauna, mobilidade, alongamento,
 * fisioterapia, meditação). Um hábito novo sem entrada aqui é simplesmente ignorado pelo
 * motor de impacto (não quebra, só não gera insight pra ele) — extensível sem exigir
 * mudança de schema. `isApplicable` filtra respostas tipo "não se aplica" (BOOLEAN_NA) —
 * elas não contam nem como exposição nem como não-exposição, são dado ausente.
 */
export const HABIT_IMPACT_CONFIG: Record<
  string,
  {
    label: string;
    isExposed: (value: string) => boolean;
    isApplicable?: (value: string) => boolean;
    exposedLabel: string;
    notExposedLabel: string;
  }
> = {
  alcohol: {
    label: "Álcool",
    isExposed: (v) => v !== "NONE",
    exposedLabel: "dias em que consumiu álcool",
    notExposedLabel: "dias sem álcool",
  },
  caffeine: {
    label: "Cafeína à tarde/noite",
    isExposed: (v) => v === "UNTIL_AFTERNOON" || v === "AT_NIGHT",
    exposedLabel: "dias com cafeína à tarde ou à noite",
    notExposedLabel: "dias sem cafeína depois da manhã",
  },
  water: {
    label: "Hidratação",
    isExposed: (v) => v === "BELOW_TARGET",
    exposedLabel: "dias abaixo da meta de água",
    notExposedLabel: "dias na meta de água ou acima",
  },
  food: {
    label: "Alimentação",
    isExposed: (v) => v === "OFF_PLAN",
    exposedLabel: "dias com alimentação fora do planejado",
    notExposedLabel: "dias com alimentação dentro do planejado",
  },
  sauna: {
    label: "Sauna",
    isExposed: (v) => v === "YES",
    isApplicable: (v) => v !== "NOT_APPLICABLE",
    exposedLabel: "dias com sauna",
    notExposedLabel: "dias sem sauna",
  },
  mobility: {
    label: "Mobilidade",
    isExposed: (v) => v === "YES",
    isApplicable: (v) => v !== "NOT_APPLICABLE",
    exposedLabel: "dias com mobilidade",
    notExposedLabel: "dias sem mobilidade",
  },
  stretching: {
    label: "Alongamento",
    isExposed: (v) => v === "YES",
    isApplicable: (v) => v !== "NOT_APPLICABLE",
    exposedLabel: "dias com alongamento",
    notExposedLabel: "dias sem alongamento",
  },
  physio: {
    label: "Fisioterapia",
    isExposed: (v) => v === "YES",
    isApplicable: (v) => v !== "NOT_APPLICABLE",
    exposedLabel: "dias com fisioterapia",
    notExposedLabel: "dias sem fisioterapia",
  },
  meditation: {
    label: "Meditação",
    isExposed: (v) => v === "YES",
    isApplicable: (v) => v !== "NOT_APPLICABLE",
    exposedLabel: "dias com meditação",
    notExposedLabel: "dias sem meditação",
  },
};

export type HabitImpactResult = {
  habitKey: string;
  habitLabel: string;
  metricKey: string;
  metricLabel: string;
  lagDays: 0 | 1;
  exposedLabel: string;
  notExposedLabel: string;
  exposedMean: number;
  notExposedMean: number;
  exposedN: number;
  notExposedN: number;
  effect: number;
};

/**
 * Compara a média de `metricKey` entre dias "expostos" ao hábito e dias "não expostos".
 * `lagDays: 1` compara com a métrica do DIA SEGUINTE (ex: álcool à noite → Recovery de
 * amanhã); `lagDays: 0` compara no mesmo dia. Retorna null se não houver dados suficientes
 * em algum dos dois grupos (mínimo de 2 pro cálculo de desvio padrão, mas o filtro de
 * confiança de amostra fica a cargo de quem consome o resultado).
 */
export function computeHabitImpact(
  series: DailyMetric[],
  habitKey: string,
  metricKey: keyof DailyMetric,
  metricLabel: string,
  lagDays: 0 | 1,
): HabitImpactResult | null {
  const config = HABIT_IMPACT_CONFIG[habitKey];
  if (!config) return null;

  const daysWithAnswer = series.filter((d) => {
    const value = d.habitAnswers?.[habitKey];
    if (value == null) return false;
    return config.isApplicable ? config.isApplicable(value) : true;
  });
  if (daysWithAnswer.length === 0) return null;

  const targetByDateKey = lagDays === 1 ? nextDayValueByDateKey(series, metricKey) : null;

  const exposed: number[] = [];
  const notExposed: number[] = [];

  for (const day of daysWithAnswer) {
    const value = lagDays === 1 ? targetByDateKey!.get(day.dateKey) : day[metricKey];
    if (typeof value !== "number") continue;

    const isExposed = config.isExposed(day.habitAnswers![habitKey]);
    (isExposed ? exposed : notExposed).push(value);
  }

  if (exposed.length < 2 || notExposed.length < 2) return null;

  const exposedMean = mean(exposed);
  const notExposedMean = mean(notExposed);
  const effect = cohensD(exposed, notExposed);
  if (exposedMean == null || notExposedMean == null || effect == null) return null;

  return {
    habitKey,
    habitLabel: config.label,
    metricKey: String(metricKey),
    metricLabel,
    lagDays,
    exposedLabel: config.exposedLabel,
    notExposedLabel: config.notExposedLabel,
    exposedMean,
    notExposedMean,
    exposedN: exposed.length,
    notExposedN: notExposed.length,
    effect,
  };
}
