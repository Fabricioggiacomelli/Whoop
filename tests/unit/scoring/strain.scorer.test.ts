import { describe, expect, it } from "vitest";

import { computeStrainRecommendation, scoreStrain } from "@/server/scoring/strain.scorer";

import { makeBaseline, makeDay, makeHistory, makeScorerInput } from "./factories";

describe("computeStrainRecommendation", () => {
  it("uses avgTrainingDayStrain, never avgStrain diluted by rest days (regression)", () => {
    // Um atleta que descansa metade dos dias tem avgStrain bem menor que a intensidade real
    // de um dia de treino — usar avgStrain aqui recomendaria um teto artificialmente baixo
    // e marcaria quase todo treino real como "acima da faixa" (bug corrigido nesta sessão).
    const diluted = makeBaseline({ avgStrain: 6, avgTrainingDayStrain: 14 });
    const recommendation = computeStrainRecommendation(diluted, 60, null);

    // Com bandMultiplier=1 (recovery 60 -> banda "amarela"): max = 14 * 1.15 * 1 = 16.1
    expect(recommendation.max).toBeCloseTo(16.1, 1);
    expect(recommendation.max).toBeGreaterThan(diluted.avgStrain! * 1.15);
  });

  it("raises the ceiling on high recovery and lowers it on low recovery", () => {
    const baseline = makeBaseline({ avgTrainingDayStrain: 10 });
    const greenDay = computeStrainRecommendation(baseline, 80, null);
    const redDay = computeStrainRecommendation(baseline, 20, null);

    expect(greenDay.max).toBeGreaterThan(redDay.max);
  });

  it("never increases the ceiling under recovery mode, only reduces it", () => {
    const baseline = makeBaseline({ avgTrainingDayStrain: 12 });
    const normal = computeStrainRecommendation(baseline, 60, null);
    const sick = computeStrainRecommendation(baseline, 60, { type: "SICK" });

    expect(sick.max).toBeLessThan(normal.max);
  });
});

describe("scoreStrain", () => {
  it("gives full marks for a rest day regardless of recovery — training is never mandatory", () => {
    const input = makeScorerInput({ today: makeDay({ trained: false, strain: 0 }) });
    const result = scoreStrain(input);
    expect(result.pointsEarned).toBe(25);
  });

  it("gives full marks when training stays within the recommended range", () => {
    const input = makeScorerInput({
      baseline: makeBaseline({ avgTrainingDayStrain: 12 }),
      today: makeDay({ trained: true, strain: 12, recovery: { recoveryScore: 60, hrvMs: 60, restingHeartRate: 55 } }),
    });
    const result = scoreStrain(input);
    expect(result.pointsEarned).toBe(25);
  });

  it("penalizes strain far above the recommended range", () => {
    const input = makeScorerInput({
      baseline: makeBaseline({ avgTrainingDayStrain: 10 }),
      today: makeDay({ trained: true, strain: 21, recovery: { recoveryScore: 50, hrvMs: 60, restingHeartRate: 55 } }),
    });
    const result = scoreStrain(input);
    expect(result.pointsEarned).toBeLessThan(25);
  });

  it("applies an extra penalty for repeated overage on top of the day's own penalty", () => {
    const baseInput = makeScorerInput({
      baseline: makeBaseline({ avgTrainingDayStrain: 10 }),
      today: makeDay({ trained: true, strain: 21, recovery: { recoveryScore: 50, hrvMs: 60, restingHeartRate: 55 } }),
    });
    const withoutRepeat = scoreStrain(baseInput);

    const withRepeat = scoreStrain({
      ...baseInput,
      history: makeHistory({ strainOverageDaysInLast7: 4 }),
    });

    expect(withRepeat.pointsEarned).toBeLessThan(withoutRepeat.pointsEarned);
    expect(withRepeat.adjustments.some((a) => a.ruleKey === "strain.overage.repeated")).toBe(true);
  });
});
