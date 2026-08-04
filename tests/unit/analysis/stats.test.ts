import { describe, expect, it } from "vitest";

import {
  cohensD,
  coefficientOfVariation,
  confidenceFromSampleSize,
  ewma,
  linearTrend,
  mean,
  median,
  movingAverage,
  pearsonCorrelation,
  percentChange,
  percentile,
  stddev,
  winsorize,
  zScore,
} from "@/server/analysis/stats";

describe("mean/median/stddev", () => {
  it("computes mean of a simple list", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns null mean for an empty list", () => {
    expect(mean([])).toBeNull();
  });

  it("computes median for odd and even length lists", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("computes sample stddev (n-1) matching a known value", () => {
    // Média 5, desvios [-2,-1,0,1,2] -> soma quadrados 10 / (5-1) = 2.5 -> sqrt ~1.5811
    expect(stddev([3, 4, 5, 6, 7])).toBeCloseTo(1.5811, 3);
  });

  it("returns null stddev with fewer than 2 points", () => {
    expect(stddev([5])).toBeNull();
  });
});

describe("percentile", () => {
  it("computes p50 as the median for an odd-length list", () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  it("interpolates linearly for percentiles between points", () => {
    // [10,20,30,40] p25 -> rank 0.75 -> 10 + 0.75*(20-10) = 17.5
    expect(percentile([10, 20, 30, 40], 25)).toBe(17.5);
  });
});

describe("coefficientOfVariation", () => {
  it("is null when mean is zero", () => {
    expect(coefficientOfVariation([-1, 0, 1])).toBeNull();
  });

  it("computes stddev/mean", () => {
    const cv = coefficientOfVariation([8, 10, 12]);
    expect(cv).toBeCloseTo(stddev([8, 10, 12])! / 10, 6);
  });
});

describe("movingAverage", () => {
  it("returns null until the window is filled, then the trailing average", () => {
    const result = movingAverage([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });
});

describe("ewma", () => {
  it("starts at the first value and moves toward new values", () => {
    const result = ewma([10, 10, 10, 20], 2); // alpha = 2/3
    expect(result[0]).toBe(10);
    expect(result[3]).toBeCloseTo(10 + (2 / 3) * (20 - 10 - (2/3)*0), 0); // sanity: trends toward 20
    expect(result[3]!).toBeGreaterThan(10);
    expect(result[3]!).toBeLessThan(20);
  });
});

describe("zScore", () => {
  it("returns 0 for a value equal to the baseline mean", () => {
    expect(zScore(10, [8, 9, 10, 11, 12])).toBe(0);
  });

  it("returns a positive score for a value above baseline mean", () => {
    expect(zScore(14, [8, 9, 10, 11, 12])).toBeGreaterThan(0);
  });

  it("is null when baseline has zero variance", () => {
    expect(zScore(10, [5, 5, 5])).toBeNull();
  });
});

describe("percentChange", () => {
  it("computes a positive percent change", () => {
    expect(percentChange(110, 100)).toBeCloseTo(10, 6);
  });

  it("is null when previous is zero or null", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, null)).toBeNull();
  });
});

describe("linearTrend", () => {
  it("detects a clear upward trend", () => {
    const trend = linearTrend([10, 20, 30, 40, 50, 60]);
    expect(trend?.direction).toBe("up");
    expect(trend?.slopePerDay).toBeCloseTo(10, 6);
    expect(trend?.r2).toBeCloseTo(1, 6);
  });

  it("detects a clear downward trend", () => {
    const trend = linearTrend([60, 50, 40, 30, 20, 10]);
    expect(trend?.direction).toBe("down");
  });

  it("classifies flat noisy data as stable, not a fabricated trend", () => {
    const trend = linearTrend([50, 51, 49, 50, 50, 51, 49, 50]);
    expect(trend?.direction).toBe("stable");
  });

  it("returns null with fewer than 3 points", () => {
    expect(linearTrend([1, 2])).toBeNull();
  });
});

describe("pearsonCorrelation", () => {
  it("returns close to 1 for a perfectly linear positive relationship", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(r).toBeCloseTo(1, 6);
  });

  it("returns close to -1 for a perfectly linear inverse relationship", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    expect(r).toBeCloseTo(-1, 6);
  });

  it("returns null with fewer than 3 paired points", () => {
    expect(pearsonCorrelation([1, 2], [1, 2])).toBeNull();
  });
});

describe("cohensD", () => {
  it("is near zero for two samples with the same distribution", () => {
    const d = cohensD([10, 11, 9, 10, 11, 9, 10], [10, 9, 11, 10, 9, 11, 10]);
    expect(Math.abs(d ?? 0)).toBeLessThan(0.3);
  });

  it("is large for two clearly separated groups", () => {
    const d = cohensD([80, 82, 78, 81, 79], [40, 42, 38, 41, 39]);
    expect(d).toBeGreaterThan(2);
  });
});

describe("confidenceFromSampleSize", () => {
  it("follows the documented thresholds", () => {
    expect(confidenceFromSampleSize(3)).toBe("insufficient");
    expect(confidenceFromSampleSize(5)).toBe("exploratory");
    expect(confidenceFromSampleSize(9)).toBe("exploratory");
    expect(confidenceFromSampleSize(10)).toBe("low");
    expect(confidenceFromSampleSize(19)).toBe("low");
    expect(confidenceFromSampleSize(20)).toBe("moderate");
    expect(confidenceFromSampleSize(39)).toBe("moderate");
    expect(confidenceFromSampleSize(40)).toBe("good");
  });
});

describe("winsorize", () => {
  it("clamps outliers to the percentile bounds without dropping points", () => {
    const values = [10, 11, 12, 13, 14, 1000];
    const result = winsorize(values, 5, 95);
    expect(result.length).toBe(values.length);
    expect(Math.max(...result)).toBeLessThan(1000);
  });
});
