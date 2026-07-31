import { describe, expect, it } from "vitest";

import { scoreSleep } from "@/server/scoring/sleep.scorer";

import { makeDay, makeScorerInput } from "./factories";

describe("scoreSleep", () => {
  it("scores zero with no adjustments when there is no sleep data", () => {
    const input = makeScorerInput({ today: makeDay({ sleep: null }) });
    const result = scoreSleep(input);
    expect(result.pointsEarned).toBe(0);
    expect(result.adjustments).toHaveLength(0);
  });

  it("applies a penalty for late-night caffeine on top of the sleep metrics", () => {
    const withoutCaffeine = scoreSleep(makeScorerInput({ today: makeDay({ journalAnswers: null }) }));
    const withCaffeine = scoreSleep(
      makeScorerInput({ today: makeDay({ journalAnswers: { caffeine: "AT_NIGHT" } }) }),
    );

    expect(withCaffeine.pointsEarned).toBeLessThan(withoutCaffeine.pointsEarned);
    expect(withCaffeine.adjustments.some((a) => a.ruleKey === "habits.caffeine_at_night")).toBe(true);
  });

  it("penalizes an accumulated sleep debt", () => {
    const noDebt = scoreSleep(makeScorerInput({ today: makeDay({ sleep: { ...makeDay().sleep!, sleepDebtMinutes: 0 } }) }));
    const highDebt = scoreSleep(
      makeScorerInput({ today: makeDay({ sleep: { ...makeDay().sleep!, sleepDebtMinutes: 250 } }) }),
    );

    expect(highDebt.pointsEarned).toBeLessThan(noDebt.pointsEarned);
  });
});
