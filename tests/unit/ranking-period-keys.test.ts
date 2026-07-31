import { describe, expect, it } from "vitest";

import { dailyPeriodKey, monthlyPeriodKey, weeklyPeriodKey } from "@/server/services/ranking.service";

describe("ranking period keys", () => {
  it("formats the daily key as yyyy-MM-dd", () => {
    expect(dailyPeriodKey(new Date("2026-07-30T12:00:00Z"))).toBe("2026-07-30");
  });

  it("formats the monthly key as yyyy-MM", () => {
    expect(monthlyPeriodKey(new Date("2026-07-30T12:00:00Z"))).toBe("2026-07");
  });

  it("buckets dates in the same ISO week (Mon-Sun) under the same weekly key", () => {
    // 2026-07-27 é uma segunda-feira; 2026-08-02 é o domingo da mesma semana ISO.
    const monday = weeklyPeriodKey(new Date("2026-07-27T12:00:00Z"));
    const sunday = weeklyPeriodKey(new Date("2026-08-02T12:00:00Z"));
    expect(monday).toBe(sunday);
  });

  it("puts consecutive weeks in different, lexically-ordered keys", () => {
    const weekOne = weeklyPeriodKey(new Date("2026-07-27T12:00:00Z"));
    const weekTwo = weeklyPeriodKey(new Date("2026-08-03T12:00:00Z"));
    expect(weekOne).not.toBe(weekTwo);
    expect(weekOne < weekTwo).toBe(true);
  });
});
