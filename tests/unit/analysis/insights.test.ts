import { describe, expect, it } from "vitest";

import type { DailyMetric } from "@/server/analysis/types";
import { dateKey } from "@/server/analysis/timeframes";
import { computeHabitImpact } from "@/server/analysis/habits";
import { nextDayValueByDateKey } from "@/server/analysis/metrics";
import {
  generateAllInsights,
  generateHabitInsights,
  generateSleepDurationInsight,
  generateStrainRecoveryInsight,
  generateTrendInsights,
} from "@/server/analysis/insights";

/** Cria uma série de N dias consecutivos a partir de 2026-01-01, com overrides por índice. */
function buildSeries(
  days: number,
  fill: (i: number) => Partial<DailyMetric>,
): DailyMetric[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(2026, 0, 1 + i));
    const base: DailyMetric = {
      date,
      dateKey: dateKey(date),
      recoveryScore: null,
      hrvMs: null,
      restingHeartRate: null,
      sleepPerformancePct: null,
      sleepEfficiencyPct: null,
      timeInBedHours: null,
      sleepDebtMinutes: null,
      disturbanceCount: null,
      bedTimeMinutesOfDay: null,
      strain: null,
      trained: false,
      habitAnswers: null,
    };
    return { ...base, ...fill(i) };
  });
}

// Gerador determinístico (sem dependências externas) só pra dar variação realista sem
// tornar o teste flaky — mesma seed sempre produz a mesma série.
function noise(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}

describe("generateHabitInsights — ground truth datasets (spec §60)", () => {
  it("detects an artificially strong alcohol -> lower next-day Recovery effect", () => {
    // 30 dias. Álcool nos dias pares (índice par), afeta o Recovery do dia SEGUINTE.
    const series = buildSeries(30, (i) => {
      const drankYesterday = i > 0 && (i - 1) % 2 === 0;
      return {
        recoveryScore: (drankYesterday ? 45 : 75) + noise(i, 4),
        habitAnswers: { alcohol: i % 2 === 0 ? "TWO_DRINKS" : "NONE" },
      };
    });

    const insights = generateHabitInsights(series);
    const alcoholInsight = insights.find((i) => i.id.startsWith("habit:alcohol:recoveryScore"));

    expect(alcoholInsight).toBeDefined();
    expect(alcoholInsight!.polarity).toBe("negative");
    expect(alcoholInsight!.confidence).not.toBe("insufficient");
    expect(alcoholInsight!.effectMagnitude).toBeGreaterThan(0.5);
  });

  it("does NOT invent a correlation when there is no real relationship", () => {
    // 30 dias, Recovery é ruído puro em torno de 65 independente do hábito registrado —
    // não deve gerar insight de "food" (nem qualquer outro) neste dataset.
    const series = buildSeries(30, (i) => ({
      recoveryScore: 65 + noise(i, 5),
      habitAnswers: { food: i % 2 === 0 ? "OFF_PLAN" : "ON_PLAN" },
    }));

    const insights = generateHabitInsights(series);
    const foodInsight = insights.find((i) => i.id.startsWith("habit:food:recoveryScore"));

    expect(foodInsight).toBeUndefined();
  });

  it("ignores days without a submitted journal answer (missing data is not treated as a value)", () => {
    const series = buildSeries(10, (i) => ({
      recoveryScore: 70,
      habitAnswers: i < 5 ? { alcohol: "NONE" } : null,
    }));

    const result = computeHabitImpact(series, "alcohol", "recoveryScore", "Recovery", 0);
    // Só 5 dias têm resposta -> nenhum dos dois grupos (exposto/não exposto) chega a ter
    // ambos com >=2 pontos junto de comparação, então o resultado deve ser null ou refletir
    // só os 5 dias respondidos, nunca os 10.
    if (result) {
      expect(result.exposedN + result.notExposedN).toBeLessThanOrEqual(5);
    }
  });

  it("requires a minimum sample size before surfacing an insight even with a real-looking gap", () => {
    // Só 3 dias no total — abaixo do mínimo de 5 por grupo, mesmo com uma diferença grande.
    const series = buildSeries(3, (i) => ({
      recoveryScore: i === 0 ? 40 : 80,
      habitAnswers: { alcohol: i === 0 ? "TWO_DRINKS" : "NONE" },
    }));

    const insights = generateHabitInsights(series);
    expect(insights.find((i) => i.id.startsWith("habit:alcohol"))).toBeUndefined();
  });
});

describe("nextDayValueByDateKey — lag+1 join", () => {
  it("joins each day to the metric value of the immediately following calendar day", () => {
    const series = buildSeries(5, (i) => ({ recoveryScore: 50 + i * 10 }));
    const joined = nextDayValueByDateKey(series, "recoveryScore");

    expect(joined.get(series[0].dateKey)).toBe(60); // dia 0 -> recovery do dia 1
    expect(joined.get(series[3].dateKey)).toBe(90); // dia 3 -> recovery do dia 4
    expect(joined.has(series[4].dateKey)).toBe(false); // último dia não tem "amanhã" na série
  });

  it("does not join across a gap in the series (missing day breaks the lag)", () => {
    const series = buildSeries(5, (i) => ({ recoveryScore: 50 + i * 10 })).filter((_, i) => i !== 2);
    const joined = nextDayValueByDateKey(series, "recoveryScore");

    // Dia 1 (índice original) deveria linkar pro dia 2, que foi removido -> sem join.
    expect(joined.has(series[1].dateKey)).toBe(false);
  });
});

describe("generateSleepDurationInsight — sleep bucketing (item 15)", () => {
  it("detects that longer sleep associates with higher same-day Recovery", () => {
    const series = buildSeries(20, (i) => ({
      timeInBedHours: i % 2 === 0 ? 5.5 : 8,
      recoveryScore: (i % 2 === 0 ? 50 : 78) + noise(i, 3),
    }));

    const insight = generateSleepDurationInsight(series);
    expect(insight).toBeDefined();
    expect(insight!.polarity).toBe("positive");
  });
});

describe("generateStrainRecoveryInsight — Strain x next-day Recovery (item 16)", () => {
  it("detects a dose-response relationship between today's Strain and tomorrow's Recovery", () => {
    const series = buildSeries(20, (i) => {
      const strain = 6 + (i % 10) * 1.5; // varia de 6 a 19.5
      return { strain, trained: true };
    }).map((d, i, arr) => {
      // Recovery de amanhã cai conforme o Strain de hoje sobe (relação inversa clara).
      if (i === 0) return d;
      const prevStrain = arr[i - 1].strain!;
      return { ...d, recoveryScore: 90 - prevStrain * 2 + noise(i, 2) };
    });

    const insight = generateStrainRecoveryInsight(series);
    expect(insight).toBeDefined();
    expect(insight!.polarity).toBe("negative");
  });

  it("does not report a relationship when Strain and next-day Recovery are unrelated", () => {
    const series = buildSeries(20, (i) => ({
      strain: 6 + (i % 10) * 1.5,
      trained: true,
      recoveryScore: 65 + noise(i, 6),
    }));

    const insight = generateStrainRecoveryInsight(series);
    expect(insight).toBeNull();
  });
});

describe("generateTrendInsights — outlier resistance", () => {
  it("does not fabricate a trend out of a single extreme outlier in an otherwise flat series", () => {
    const series = buildSeries(14, (i) => ({ recoveryScore: i === 7 ? 5 : 70 }));
    const insights = generateTrendInsights(series);
    expect(insights.find((i) => i.id === "trend:recoveryScore")).toBeUndefined();
  });
});

describe("generateAllInsights — ranking", () => {
  it("ranks higher-confidence, higher-effect insights first", () => {
    const series = buildSeries(30, (i) => {
      const drankYesterday = i > 0 && (i - 1) % 2 === 0;
      return {
        recoveryScore: (drankYesterday ? 40 : 78) + noise(i, 3),
        habitAnswers: { alcohol: i % 2 === 0 ? "THREE_PLUS" : "NONE" },
      };
    });

    const insights = generateAllInsights(series);
    expect(insights.length).toBeGreaterThan(0);
    for (let i = 1; i < insights.length; i++) {
      const confidenceRank = { good: 4, moderate: 3, low: 2, exploratory: 1, insufficient: 0 };
      const prevRank = confidenceRank[insights[i - 1].confidence];
      const curRank = confidenceRank[insights[i].confidence];
      expect(prevRank).toBeGreaterThanOrEqual(curRank);
    }
  });
});
