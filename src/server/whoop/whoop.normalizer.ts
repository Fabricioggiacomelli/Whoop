import type {
  WhoopBodyMeasurementRaw,
  WhoopCycleRaw,
  WhoopRecoveryRaw,
  WhoopSleepRaw,
  WhoopWorkoutRaw,
} from "./whoop.types";

function msToMin(ms: number | null | undefined): number | null {
  if (ms == null) return null;
  return Math.round(ms / 60_000);
}

/** `true` só quando a WHOOP considera o dado pronto — nunca inferido pela mera presença do registro. */
export function isScored(scoreState: string): boolean {
  return scoreState === "SCORED";
}

export function normalizeCycle(raw: WhoopCycleRaw) {
  return {
    externalId: String(raw.id),
    startedAt: new Date(raw.start),
    endedAt: raw.end ? new Date(raw.end) : null,
    strain: raw.score?.strain ?? null,
    raw: raw as object,
  };
}

export function normalizeRecovery(raw: WhoopRecoveryRaw) {
  return {
    externalId: `${raw.cycle_id}:${raw.sleep_id}`,
    recoveryScore: raw.score?.recovery_score ?? null,
    hrvMs: raw.score?.hrv_rmssd_milli ?? null,
    restingHeartRate: raw.score?.resting_heart_rate ?? null,
    skinTempCelsius: raw.score?.skin_temp_celsius ?? null,
    spo2Percentage: raw.score?.spo2_percentage ?? null,
    raw: raw as object,
  };
}

export function normalizeSleep(raw: WhoopSleepRaw) {
  const stage = raw.score?.stage_summary;
  const need = raw.score?.sleep_needed;

  const sleepNeedMinutes = need
    ? msToMin(
        need.baseline_milli +
          need.need_from_sleep_debt_milli +
          need.need_from_recent_strain_milli +
          need.need_from_recent_nap_milli,
      )
    : null;

  const timeInBedMinutes = msToMin(stage?.total_in_bed_time_milli);
  const sleepDebtMinutes =
    sleepNeedMinutes != null && timeInBedMinutes != null
      ? Math.max(0, sleepNeedMinutes - timeInBedMinutes)
      : null;

  return {
    externalId: raw.id,
    startedAt: new Date(raw.start),
    endedAt: new Date(raw.end),
    isNap: raw.nap,
    sleepPerformancePct: raw.score?.sleep_performance_percentage ?? null,
    sleepEfficiencyPct: raw.score?.sleep_efficiency_percentage ?? null,
    sleepNeedMinutes,
    timeInBedMinutes,
    remMinutes: msToMin(stage?.total_rem_sleep_time_milli),
    deepMinutes: msToMin(stage?.total_slow_wave_sleep_time_milli),
    lightMinutes: msToMin(stage?.total_light_sleep_time_milli),
    awakeMinutes: msToMin(stage?.total_awake_time_milli),
    disturbanceCount: stage?.disturbance_count ?? null,
    sleepDebtMinutes,
    raw: raw as object,
  };
}

/**
 * `/user/measurement/body` devolve a medida ATUAL do usuário, não uma lista com IDs
 * próprios (diferente dos demais recursos) — schema exato ainda não exercitado contra a API
 * real. `externalId` é sintetizado por dia (usuário + data) para o upsert ficar idempotente
 * mesmo sem um ID nativo da WHOOP.
 */
export function normalizeBodyMeasurement(userId: string, raw: WhoopBodyMeasurementRaw, measuredAt = new Date()) {
  const dayKey = measuredAt.toISOString().slice(0, 10);
  return {
    externalId: `${userId}:${dayKey}`,
    measuredAt,
    heightMeters: raw.height_meter ?? null,
    weightKg: raw.weight_kilogram ?? null,
    maxHeartRate: raw.max_heart_rate ?? null,
    raw: raw as object,
  };
}

export function normalizeWorkout(raw: WhoopWorkoutRaw) {
  return {
    externalId: raw.id,
    sportName: raw.sport_name,
    startedAt: new Date(raw.start),
    endedAt: new Date(raw.end),
    strain: raw.score?.strain ?? null,
    averageHeartRate: raw.score?.average_heart_rate ?? null,
    maxHeartRate: raw.score?.max_heart_rate ?? null,
    kilojoules: raw.score?.kilojoule ?? null,
    zoneDurations: raw.score?.zone_durations ? (raw.score.zone_durations as object) : undefined,
    raw: raw as object,
  };
}
