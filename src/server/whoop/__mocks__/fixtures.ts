import type {
  WhoopCycleRaw,
  WhoopPaginated,
  WhoopRecoveryRaw,
  WhoopSleepRaw,
  WhoopWorkoutRaw,
} from "../whoop.types";

/**
 * Fixtures determinísticas para `WHOOP_MODE=mock` — usadas pelo `WhoopClient` para exercitar
 * todo o pipeline de sync (import histórico, normalizer, upsert) sem credenciais reais.
 * Não confundir com `prisma/seed.ts`, que cria dados ricos direto no banco para a demo do
 * produto — isto aqui testa o *código de integração* em si.
 */
const MOCK_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function mockCycleId(userSeed: number, dayIndex: number) {
  return userSeed * 100_000 + dayIndex;
}

export function buildMockCycles(userSeed: number, anchor: Date): WhoopPaginated<WhoopCycleRaw> {
  const records: WhoopCycleRaw[] = Array.from({ length: MOCK_DAYS }, (_, i) => {
    const start = new Date(anchor.getTime() - (MOCK_DAYS - i) * DAY_MS);
    return {
      id: mockCycleId(userSeed, i),
      user_id: userSeed,
      created_at: start.toISOString(),
      updated_at: start.toISOString(),
      start: start.toISOString(),
      end: new Date(start.getTime() + DAY_MS).toISOString(),
      timezone_offset: "-03:00",
      score_state: "SCORED",
      score: { strain: 8 + i, kilojoule: 6000, average_heart_rate: 70, max_heart_rate: 150 },
    };
  });

  return { records, next_token: null };
}

export function buildMockRecoveries(userSeed: number, anchor: Date): WhoopPaginated<WhoopRecoveryRaw> {
  const records: WhoopRecoveryRaw[] = Array.from({ length: MOCK_DAYS }, (_, i) => {
    const date = new Date(anchor.getTime() - (MOCK_DAYS - i) * DAY_MS);
    return {
      cycle_id: mockCycleId(userSeed, i),
      sleep_id: `mock-sleep-${userSeed}-${i}`,
      user_id: userSeed,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      score_state: "SCORED",
      score: {
        user_calibrating: false,
        recovery_score: 60 + i,
        resting_heart_rate: 55,
        hrv_rmssd_milli: 65,
        spo2_percentage: 97,
        skin_temp_celsius: 33.5,
      },
    };
  });

  return { records, next_token: null };
}

export function buildMockSleeps(userSeed: number, anchor: Date): WhoopPaginated<WhoopSleepRaw> {
  const records: WhoopSleepRaw[] = Array.from({ length: MOCK_DAYS }, (_, i) => {
    const start = new Date(anchor.getTime() - (MOCK_DAYS - i) * DAY_MS + 22 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7.5 * 60 * 60 * 1000);
    return {
      id: `mock-sleep-${userSeed}-${i}`,
      cycle_id: mockCycleId(userSeed, i),
      v1_id: null,
      user_id: userSeed,
      created_at: start.toISOString(),
      updated_at: end.toISOString(),
      start: start.toISOString(),
      end: end.toISOString(),
      timezone_offset: "-03:00",
      nap: false,
      score_state: "SCORED",
      score: {
        stage_summary: {
          total_in_bed_time_milli: 7.5 * 60 * 60 * 1000,
          total_awake_time_milli: 20 * 60 * 1000,
          total_no_data_time_milli: 0,
          total_light_sleep_time_milli: 3.5 * 60 * 60 * 1000,
          total_slow_wave_sleep_time_milli: 1.5 * 60 * 60 * 1000,
          total_rem_sleep_time_milli: 2 * 60 * 60 * 1000,
          sleep_cycle_count: 5,
          disturbance_count: 2,
        },
        sleep_needed: {
          baseline_milli: 8 * 60 * 60 * 1000,
          need_from_sleep_debt_milli: 0,
          need_from_recent_strain_milli: 0,
          need_from_recent_nap_milli: 0,
        },
        respiratory_rate: 15.2,
        sleep_performance_percentage: 88 + i,
        sleep_consistency_percentage: 80,
        sleep_efficiency_percentage: 91,
      },
    };
  });

  return { records, next_token: null };
}

export function buildMockWorkouts(userSeed: number, anchor: Date): WhoopPaginated<WhoopWorkoutRaw> {
  const start = new Date(anchor.getTime() - DAY_MS + 8 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 45 * 60 * 1000);

  return {
    records: [
      {
        id: `mock-workout-${userSeed}-0`,
        v1_id: null,
        user_id: userSeed,
        created_at: start.toISOString(),
        updated_at: end.toISOString(),
        start: start.toISOString(),
        end: end.toISOString(),
        timezone_offset: "-03:00",
        sport_name: "Corrida",
        sport_id: 1,
        score_state: "SCORED",
        score: {
          strain: 10.5,
          average_heart_rate: 145,
          max_heart_rate: 172,
          kilojoule: 2200,
          percent_recorded: 100,
          distance_meter: 8000,
          altitude_gain_meter: 50,
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
      },
    ],
    next_token: null,
  };
}
