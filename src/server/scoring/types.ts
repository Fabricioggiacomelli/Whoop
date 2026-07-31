import type { RecoveryModeType } from "@/generated/prisma/enums";

/** Dados normalizados de um dia competitivo — já traduzidos do formato WHOOP. */
export type DayInput = {
  competitiveDate: Date;
  sleep: {
    sleepPerformancePct: number | null;
    sleepEfficiencyPct: number | null;
    sleepNeedMinutes: number | null;
    timeInBedMinutes: number | null;
    remMinutes: number | null;
    deepMinutes: number | null;
    disturbanceCount: number | null;
    sleepDebtMinutes: number | null;
    startedAt: Date;
  } | null;
  recovery: {
    recoveryScore: number | null;
    hrvMs: number | null;
    restingHeartRate: number | null;
  } | null;
  strain: number | null; // strain do ciclo do dia (0 se não treinou)
  trained: boolean;
  journalAnswers: Record<string, string> | null; // null = Journal não respondido
};

/** Linha de base do usuário — janela móvel, sempre relativa ao próprio indivíduo. */
export type Baseline = {
  windowDays: number;
  sampleDays: number;
  avgSleepPerfPct: number | null;
  avgHrvMs: number | null;
  avgRestingHr: number | null;
  avgRecoveryScore: number | null;
  /** Média de Strain incluindo dias de descanso (0) — carga real ao longo do tempo. */
  avgStrain: number | null;
  /** Média de Strain só nos dias em que treinou — intensidade típica de um dia de treino,
   *  usada para definir o teto recomendado (nunca diluída por dias de descanso). */
  avgTrainingDayStrain: number | null;
  acuteLoad7d: number | null; // média de strain (com descanso) nos últimos 7 dias
  chronicLoad28d: number | null; // média de strain (com descanso) nos últimos 28 dias
};

export type RecoveryModeInfo = { type: RecoveryModeType } | null;

/** Contexto histórico necessário para consistência/overtraining sem reconsultar o banco a cada scorer. */
export type HistoryContext = {
  /** Sequência de dias consecutivos com dados completos, terminando ontem (não inclui hoje). */
  consecutiveDaysWithData: number;
  /** Quantos dos últimos 7 dias tiveram Strain acima da faixa recomendada (aproximação). */
  strainOverageDaysInLast7: number;
  /** 0 (irregular) a 1 (muito regular) — desvio do horário de dormir nos últimos 14 dias. */
  bedtimeConsistency: number;
};

export type RulesMap = ReadonlyMap<string, unknown>;

export type ScoreAdjustmentResult = {
  type: "BONUS" | "PENALTY";
  reason: string;
  points: number;
  ruleKey: string;
};

export type ScorerResult = {
  pointsPossible: number;
  pointsEarned: number;
  inputValue?: unknown;
  normalizedValue?: unknown;
  metricUsed?: string;
  baselineComparison?: Record<string, number | null>;
  explanation: string;
  recommendation: string;
  ruleApplied?: string;
  adjustments: ScoreAdjustmentResult[];
};

export type ScorerInput = {
  today: DayInput;
  baseline: Baseline;
  rules: RulesMap;
  recoveryMode: RecoveryModeInfo;
  history: HistoryContext;
  /** Recomendação de Strain do dia — calculada por strain.scorer e reutilizada por outros. */
  strainRecommendation?: { min: number; max: number };
  /** Janelas curta (7-14d) e média (60-90d) usadas só pelo EvolutionScorer — ver SCORING.md §8. */
  recentBaseline: Baseline;
  longBaseline: Baseline;
};
