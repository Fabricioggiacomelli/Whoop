/**
 * Tipos do formato bruto da API da WHOOP v2 — confirmados contra
 * https://developer.whoop.com/api/ (ver WHOOP_INTEGRATION.md §1). Nada fora de
 * `src/server/whoop/*` deve importar estes tipos; o resto do sistema só conhece o formato
 * normalizado (Prisma).
 */

export type WhoopScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE";

export type WhoopPaginated<T> = {
  records: T[];
  next_token: string | null;
};

export type WhoopCycleRaw = {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  score_state: WhoopScoreState;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  } | null;
};

export type WhoopRecoveryRaw = {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: WhoopScoreState;
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number | null;
    skin_temp_celsius: number | null;
  } | null;
};

export type WhoopSleepRaw = {
  id: string;
  cycle_id: number | null;
  v1_id: number | null;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: WhoopScoreState;
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number | null;
    sleep_performance_percentage: number | null;
    sleep_consistency_percentage: number | null;
    sleep_efficiency_percentage: number | null;
  } | null;
};

export type WhoopWorkoutRaw = {
  id: string;
  v1_id: number | null;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  sport_id: number;
  score_state: WhoopScoreState;
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    distance_meter: number | null;
    altitude_gain_meter: number | null;
    altitude_change_meter: number | null;
    zone_durations: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  } | null;
};

export type WhoopBodyMeasurementRaw = {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
};

export type WhoopProfileRaw = {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
};

/** Payload de webhook — confirmado: só recovery/sleep/workout, nunca cycle/body_measurement. */
export type WhoopWebhookEventType =
  | "recovery.updated"
  | "recovery.deleted"
  | "workout.updated"
  | "workout.deleted"
  | "sleep.updated"
  | "sleep.deleted";

export type WhoopWebhookPayload = {
  user_id: number;
  id: number | string;
  type: WhoopWebhookEventType;
  trace_id: string;
};

export type WhoopTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export type WhoopResource = "cycle" | "recovery" | "sleep" | "workout" | "body_measurement";
