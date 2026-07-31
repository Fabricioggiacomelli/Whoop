import type { Baseline, DayInput, HistoryContext, RulesMap, ScorerInput } from "@/server/scoring/types";

export function makeBaseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    windowDays: 28,
    sampleDays: 28,
    avgSleepPerfPct: 80,
    avgHrvMs: 60,
    avgRestingHr: 55,
    avgRecoveryScore: 60,
    avgStrain: 8,
    avgTrainingDayStrain: 12,
    acuteLoad7d: 8,
    chronicLoad28d: 8,
    ...overrides,
  };
}

export function makeHistory(overrides: Partial<HistoryContext> = {}): HistoryContext {
  return {
    consecutiveDaysWithData: 10,
    strainOverageDaysInLast7: 0,
    bedtimeConsistency: 0.8,
    ...overrides,
  };
}

export function makeDay(overrides: Partial<DayInput> = {}): DayInput {
  return {
    competitiveDate: new Date("2026-07-30"),
    sleep: {
      sleepPerformancePct: 85,
      sleepEfficiencyPct: 90,
      sleepNeedMinutes: 470,
      timeInBedMinutes: 480,
      remMinutes: 100,
      deepMinutes: 90,
      disturbanceCount: 2,
      sleepDebtMinutes: 0,
      startedAt: new Date("2026-07-29T22:00:00.000Z"),
    },
    recovery: { recoveryScore: 65, hrvMs: 62, restingHeartRate: 54 },
    strain: 0,
    trained: false,
    journalAnswers: null,
    ...overrides,
  };
}

export function makeScorerInput(overrides: Partial<ScorerInput> = {}): ScorerInput {
  const baseline = makeBaseline();
  return {
    today: makeDay(),
    baseline,
    rules: new Map() as RulesMap,
    recoveryMode: null,
    history: makeHistory(),
    recentBaseline: baseline,
    longBaseline: baseline,
    ...overrides,
  };
}
