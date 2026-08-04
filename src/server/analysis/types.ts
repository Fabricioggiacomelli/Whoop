import type { ConfidenceLevel } from "./stats";

/** Um dia competitivo já normalizado, pronto pra qualquer cálculo estatístico da Análise. */
export type DailyMetric = {
  date: Date;
  dateKey: string;
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHeartRate: number | null;
  sleepPerformancePct: number | null;
  sleepEfficiencyPct: number | null;
  timeInBedHours: number | null;
  sleepDebtMinutes: number | null;
  disturbanceCount: number | null;
  /** Minutos desde meia-noite (fuso do app) em que o sono principal começou — regularidade do horário de dormir. */
  bedTimeMinutesOfDay: number | null;
  strain: number | null;
  trained: boolean;
  /** habitKey -> valor textual da resposta (ex: alcohol -> "TWO_DRINKS"). Ausente = Journal não respondido. */
  habitAnswers: Record<string, string> | null;
};

export type InsightCategory =
  | "sleep"
  | "recovery"
  | "hrv"
  | "resting_hr"
  | "training"
  | "strain"
  | "habit"
  | "consistency"
  | "positive_trend"
  | "negative_trend";

export type InsightPolarity = "positive" | "negative" | "neutral";

/** Uma linha de evidência mostrada no "Por quê?" — nunca caixa-preta. */
export type InsightEvidence = {
  label: string;
  value: string;
};

export type Insight = {
  id: string;
  category: InsightCategory;
  polarity: InsightPolarity;
  title: string;
  /** Texto sempre em linguagem não-diagnóstica (ver AGENTS.md/spec §47). */
  description: string;
  confidence: ConfidenceLevel;
  sampleSize: number;
  /** Magnitude do efeito (Cohen's d ou correlação) — usado só pra ranquear, nunca mostrado cru. */
  effectMagnitude: number;
  evidence: InsightEvidence[];
};
