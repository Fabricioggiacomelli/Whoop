import { describe, expect, it } from "vitest";

import {
  isScored,
  normalizeBodyMeasurement,
  normalizeCycle,
  normalizeRecovery,
  normalizeSleep,
  normalizeWorkout,
} from "@/server/whoop/whoop.normalizer";
import type {
  WhoopCycleRaw,
  WhoopRecoveryRaw,
  WhoopSleepRaw,
  WhoopWorkoutRaw,
} from "@/server/whoop/whoop.types";

// Fixtures no formato exato confirmado contra developer.whoop.com/api (ver WHOOP_INTEGRATION.md §1).

const rawCycle: WhoopCycleRaw = {
  id: 12345,
  user_id: 999,
  created_at: "2026-07-29T22:00:00.000Z",
  updated_at: "2026-07-30T22:00:00.000Z",
  start: "2026-07-29T22:00:00.000Z",
  end: "2026-07-30T22:00:00.000Z",
  timezone_offset: "-03:00",
  score_state: "SCORED",
  score: { strain: 12.4, kilojoule: 6500, average_heart_rate: 68, max_heart_rate: 155 },
};

const rawSleep: WhoopSleepRaw = {
  id: "a1b2c3d4-0000-0000-0000-000000000000",
  cycle_id: 12345,
  v1_id: null,
  user_id: 999,
  created_at: "2026-07-29T22:00:00.000Z",
  updated_at: "2026-07-30T06:00:00.000Z",
  start: "2026-07-29T22:00:00.000Z",
  end: "2026-07-30T06:00:00.000Z",
  timezone_offset: "-03:00",
  nap: false,
  score_state: "SCORED",
  score: {
    stage_summary: {
      total_in_bed_time_milli: 8 * 60 * 60 * 1000,
      total_awake_time_milli: 20 * 60 * 1000,
      total_no_data_time_milli: 0,
      total_light_sleep_time_milli: 3 * 60 * 60 * 1000,
      total_slow_wave_sleep_time_milli: 1.5 * 60 * 60 * 1000,
      total_rem_sleep_time_milli: 2 * 60 * 60 * 1000,
      sleep_cycle_count: 5,
      disturbance_count: 3,
    },
    sleep_needed: {
      baseline_milli: 8 * 60 * 60 * 1000,
      need_from_sleep_debt_milli: 30 * 60 * 1000,
      need_from_recent_strain_milli: 0,
      need_from_recent_nap_milli: 0,
    },
    respiratory_rate: 15.1,
    sleep_performance_percentage: 91,
    sleep_consistency_percentage: 85,
    sleep_efficiency_percentage: 93.5,
  },
};

const rawRecovery: WhoopRecoveryRaw = {
  cycle_id: 12345,
  sleep_id: "a1b2c3d4-0000-0000-0000-000000000000",
  user_id: 999,
  created_at: "2026-07-30T06:05:00.000Z",
  updated_at: "2026-07-30T06:05:00.000Z",
  score_state: "SCORED",
  score: {
    user_calibrating: false,
    recovery_score: 72,
    resting_heart_rate: 52,
    hrv_rmssd_milli: 68.4,
    spo2_percentage: 97.2,
    skin_temp_celsius: 33.6,
  },
};

const rawWorkout: WhoopWorkoutRaw = {
  id: "b1b2c3d4-0000-0000-0000-000000000000",
  v1_id: null,
  user_id: 999,
  created_at: "2026-07-30T09:00:00.000Z",
  updated_at: "2026-07-30T09:45:00.000Z",
  start: "2026-07-30T09:00:00.000Z",
  end: "2026-07-30T09:45:00.000Z",
  timezone_offset: "-03:00",
  sport_name: "Corrida",
  sport_id: 1,
  score_state: "SCORED",
  score: {
    strain: 11.2,
    average_heart_rate: 148,
    max_heart_rate: 175,
    kilojoule: 2100,
    percent_recorded: 100,
    distance_meter: 7500,
    altitude_gain_meter: 20,
    altitude_change_meter: 0,
    zone_durations: {
      zone_zero_milli: 0,
      zone_one_milli: 300_000,
      zone_two_milli: 900_000,
      zone_three_milli: 1_200_000,
      zone_four_milli: 300_000,
      zone_five_milli: 0,
    },
  },
};

describe("isScored", () => {
  it("is true only for SCORED, never PENDING_SCORE or UNSCORABLE", () => {
    expect(isScored("SCORED")).toBe(true);
    expect(isScored("PENDING_SCORE")).toBe(false);
    expect(isScored("UNSCORABLE")).toBe(false);
  });
});

describe("normalizeCycle", () => {
  it("maps id, dates and strain straight through", () => {
    const result = normalizeCycle(rawCycle);
    expect(result.externalId).toBe("12345");
    expect(result.startedAt).toEqual(new Date(rawCycle.start));
    expect(result.strain).toBe(12.4);
  });
});

describe("normalizeSleep", () => {
  it("converts every duration field from milliseconds to minutes", () => {
    const result = normalizeSleep(rawSleep);
    expect(result.remMinutes).toBe(120);
    expect(result.deepMinutes).toBe(90);
    expect(result.lightMinutes).toBe(180);
    expect(result.awakeMinutes).toBe(20);
    expect(result.timeInBedMinutes).toBe(480);
  });

  it("sums the four sleep_needed components instead of using a single field", () => {
    const result = normalizeSleep(rawSleep);
    // baseline 8h + 30min de dívida = 8h30 = 510 min
    expect(result.sleepNeedMinutes).toBe(510);
  });

  it("derives sleep debt as need minus time actually in bed, never negative", () => {
    const result = normalizeSleep(rawSleep);
    // need 510 - timeInBed 480 = 30 min de dívida
    expect(result.sleepDebtMinutes).toBe(30);

    const wellRested = normalizeSleep({
      ...rawSleep,
      score: {
        ...rawSleep.score!,
        sleep_needed: { ...rawSleep.score!.sleep_needed, need_from_sleep_debt_milli: -999_999_999 } as never,
      },
    });
    expect(wellRested.sleepDebtMinutes).toBeGreaterThanOrEqual(0);
  });

  it("passes performance/efficiency percentages straight through", () => {
    const result = normalizeSleep(rawSleep);
    expect(result.sleepPerformancePct).toBe(91);
    expect(result.sleepEfficiencyPct).toBe(93.5);
  });
});

describe("normalizeRecovery", () => {
  it("builds a stable externalId from cycle_id + sleep_id (recovery has no id of its own)", () => {
    const result = normalizeRecovery(rawRecovery);
    expect(result.externalId).toBe("12345:a1b2c3d4-0000-0000-0000-000000000000");
    expect(result.recoveryScore).toBe(72);
    expect(result.hrvMs).toBe(68.4);
  });
});

describe("normalizeWorkout", () => {
  it("maps sport name, strain and zone durations", () => {
    const result = normalizeWorkout(rawWorkout);
    expect(result.externalId).toBe(rawWorkout.id);
    expect(result.sportName).toBe("Corrida");
    expect(result.strain).toBe(11.2);
    expect(result.zoneDurations).toEqual(rawWorkout.score!.zone_durations);
  });
});

describe("normalizeBodyMeasurement", () => {
  it("synthesizes a per-day externalId since the endpoint has no native record id", () => {
    const day = new Date("2026-07-30T12:00:00.000Z");
    const result = normalizeBodyMeasurement("user-1", { height_meter: 1.8, weight_kilogram: 80, max_heart_rate: 190 }, day);
    expect(result.externalId).toBe("user-1:2026-07-30");
    expect(result.heightMeters).toBe(1.8);
  });
});
