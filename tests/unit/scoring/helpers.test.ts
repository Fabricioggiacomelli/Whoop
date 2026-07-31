import { describe, expect, it } from "vitest";

import { clamp, hasValue, round, ruleValue } from "@/server/scoring/helpers";

describe("clamp", () => {
  it("keeps values inside the range untouched", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps below the minimum", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above the maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("round", () => {
  it("rounds to the given number of decimals", () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2, 1)).toBe(1.2);
  });
});

describe("ruleValue", () => {
  it("returns the configured rule when present", () => {
    const rules = new Map<string, unknown>([["strain.overage.tier1", { penalty: -3 }]]);
    expect(ruleValue(rules, "strain.overage.tier1", { penalty: 0 })).toEqual({ penalty: -3 });
  });

  it("falls back when the rule is missing — never throws", () => {
    const rules = new Map<string, unknown>();
    expect(ruleValue(rules, "does.not.exist", { penalty: -1 })).toEqual({ penalty: -1 });
  });
});

describe("hasValue", () => {
  it("rejects null, undefined and NaN", () => {
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue(NaN)).toBe(false);
  });
  it("accepts finite numbers, including zero", () => {
    expect(hasValue(0)).toBe(true);
    expect(hasValue(42)).toBe(true);
  });
});
