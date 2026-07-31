import { describe, expect, it } from "vitest";

import { scoreHabits } from "@/server/scoring/habit.scorer";

import { makeDay, makeScorerInput } from "./factories";

describe("scoreHabits", () => {
  it("scores zero when the Journal was not answered", () => {
    const input = makeScorerInput({ today: makeDay({ journalAnswers: null }) });
    const result = scoreHabits(input);
    expect(result.pointsEarned).toBe(0);
  });

  it("rewards a full, healthy Journal", () => {
    const input = makeScorerInput({
      today: makeDay({
        journalAnswers: {
          water: "TARGET_MET",
          food: "EXCELLENT",
          alcohol: "NONE",
          sauna: "NO",
          mobility: "YES",
          stretching: "YES",
          physio: "NOT_APPLICABLE",
          meditation: "YES",
          caffeine: "MORNING_ONLY",
        },
      }),
    });
    const result = scoreHabits(input);
    expect(result.pointsEarned).toBeGreaterThan(3.5);
  });

  it("applies a penalty proportional to the number of alcohol doses", () => {
    const buildInput = (alcohol: string) =>
      makeScorerInput({
        today: makeDay({
          journalAnswers: {
            water: "TARGET_MET",
            food: "ON_PLAN",
            alcohol,
            sauna: "NO",
            mobility: "NO",
            stretching: "NO",
            physio: "NOT_APPLICABLE",
            meditation: "NO",
            caffeine: "NONE",
          },
        }),
      });

    const none = scoreHabits(buildInput("NONE"));
    const one = scoreHabits(buildInput("ONE_DRINK"));
    const three = scoreHabits(buildInput("THREE_PLUS"));

    expect(none.pointsEarned).toBeGreaterThan(one.pointsEarned);
    expect(one.pointsEarned).toBeGreaterThan(three.pointsEarned);
  });
});
