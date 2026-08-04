/**
 * Seed de desenvolvimento — cria:
 *  - 1 conta admin (login real do responsável pelo projeto)
 *  - 4 atletas fictícios com perfil, cor, WHOOP "conectado" (mock)
 *  - catálogo de hábitos do Journal
 *  - uma ScoringVersion "v1" com as regras default de SCORING.md
 *  - 90 dias de telemetria WHOOP + Journal simulados e correlacionados por atleta
 *
 * Reexecutável: apaga e recria os 4 atletas fictícios a cada run (cascade cuida do resto).
 * Não mexe na conta admin se ela já existir.
 *
 * Rodar com: npm run seed
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── PRNG determinístico (mulberry32) — dados simulados reproduzíveis entre runs. ──────────
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

type Archetype = {
  key: string;
  displayName: string;
  nickname: string;
  colorHex: string;
  goalCategory: "SLEEP" | "RECOVERY" | "STRAIN" | "HABITS" | "CONSISTENCY" | "OTHER";
  goalText: string;
  baselineHrv: number;
  baselineRhr: number;
  baselineSleepNeedMin: number;
  trainingFrequency: number; // 0..1 chance de treinar em um dia qualquer
  weekendWarrior: boolean; // treina desproporcionalmente no fim de semana
  overtrainer: boolean; // ignora recomendação de descanso com mais frequência
  alcoholTendency: number; // 0..1 chance de beber numa noite qualquer
  consistency: number; // 0..1 — quanto maior, mais estável é a rotina
  // Multiplicadores de sensibilidade individual — cada atleta tem uma "história" fisiológica
  // distinta e intencional, pra validar o motor de insights contra um ground truth conhecido
  // (ver tests/unit/analysis e AGENTS.md spec §61). 1.0 = sensibilidade padrão/leve.
  alcoholSensitivity: number;
  caffeineLateSensitivity: number;
  hrvFatigueSensitivity: number;
  bedtimeIrregularityImpact: number;
};

const ARCHETYPES: Archetype[] = [
  {
    key: "rafa",
    displayName: "Rafael Souza",
    nickname: "Rafa",
    colorHex: "#4D7BFF",
    goalCategory: "CONSISTENCY",
    goalText: "Manter rotina de sono e treino estável.",
    baselineHrv: 64,
    baselineRhr: 52,
    baselineSleepNeedMin: 470,
    trainingFrequency: 0.62,
    weekendWarrior: false,
    overtrainer: false,
    alcoholTendency: 0.16,
    consistency: 0.85,
    // História: Rafa é muito sensível a álcool — mesmo consumo moderado prejudica bem mais
    // seu sono e Recovery do dia seguinte do que os demais.
    alcoholSensitivity: 2.6,
    caffeineLateSensitivity: 0.8,
    hrvFatigueSensitivity: 0.8,
    bedtimeIrregularityImpact: 0.8,
  },
  {
    key: "bia",
    displayName: "Bianca Ferraz",
    nickname: "Bia",
    colorHex: "#FF4D8D",
    goalCategory: "STRAIN",
    goalText: "Cumprir a faixa de Strain recomendada.",
    baselineHrv: 55,
    baselineRhr: 58,
    baselineSleepNeedMin: 450,
    trainingFrequency: 0.5,
    weekendWarrior: true,
    overtrainer: false,
    alcoholTendency: 0.2,
    consistency: 0.55,
    // História: o sono da Bia é muito mais prejudicado por cafeína à tarde/noite do que o
    // dos demais — o mesmo hábito, pra ela, tem um efeito bem mais visível.
    alcoholSensitivity: 0.9,
    caffeineLateSensitivity: 2.8,
    hrvFatigueSensitivity: 0.8,
    bedtimeIrregularityImpact: 1.0,
  },
  {
    key: "theo",
    displayName: "Theo Martins",
    nickname: "Theo",
    colorHex: "#B4E23D",
    goalCategory: "RECOVERY",
    goalText: "Respeitar dias de Recovery baixa.",
    baselineHrv: 48,
    baselineRhr: 63,
    baselineSleepNeedMin: 440,
    trainingFrequency: 0.78,
    weekendWarrior: false,
    overtrainer: true,
    alcoholTendency: 0.22,
    consistency: 0.45,
    // História: o HRV do Theo cai visivelmente depois de 3+ dias seguidos de carga alta —
    // um padrão de fadiga acumulada bem mais pronunciado que nos demais.
    alcoholSensitivity: 1.0,
    caffeineLateSensitivity: 0.8,
    hrvFatigueSensitivity: 2.8,
    bedtimeIrregularityImpact: 0.9,
  },
  {
    key: "manu",
    displayName: "Manuela Prado",
    nickname: "Manu",
    colorHex: "#FFD23D",
    goalCategory: "SLEEP",
    goalText: "Dormir e acordar em horários mais regulares.",
    baselineHrv: 58,
    baselineRhr: 56,
    baselineSleepNeedMin: 460,
    trainingFrequency: 0.45,
    weekendWarrior: false,
    overtrainer: false,
    alcoholTendency: 0.15,
    consistency: 0.4,
    // História: o fator que mais afeta a Manu é irregularidade de horário de dormir — bem
    // mais que álcool, cafeína ou carga de treino.
    alcoholSensitivity: 0.9,
    caffeineLateSensitivity: 0.9,
    hrvFatigueSensitivity: 0.8,
    bedtimeIrregularityImpact: 2.8,
  },
];

const HABITS = [
  { key: "water", label: "Água", responseType: "SCALE_WATER" as const, sortOrder: 1 },
  { key: "food", label: "Alimentação", responseType: "SCALE_FOOD" as const, sortOrder: 2 },
  { key: "alcohol", label: "Álcool", responseType: "SCALE_ALCOHOL" as const, sortOrder: 3 },
  { key: "sauna", label: "Sauna", responseType: "BOOLEAN_NA" as const, sortOrder: 4 },
  { key: "mobility", label: "Mobilidade", responseType: "BOOLEAN_NA" as const, sortOrder: 5 },
  { key: "stretching", label: "Alongamento", responseType: "BOOLEAN_NA" as const, sortOrder: 6 },
  { key: "physio", label: "Fisioterapia", responseType: "BOOLEAN_NA" as const, sortOrder: 7 },
  { key: "meditation", label: "Meditação", responseType: "BOOLEAN_NA" as const, sortOrder: 8 },
  { key: "caffeine", label: "Cafeína", responseType: "SCALE_CAFFEINE" as const, sortOrder: 9 },
];

const SCORING_RULES: Record<string, unknown> = {
  "category.weights": {
    sleep: 25,
    recovery: 20,
    strain: 25,
    consistency: 15,
    evolution: 10,
    habits: 5,
  },
  "strain.overage.tolerance": { maxPct: 10, penalty: 0 },
  "strain.overage.tier1": { minPct: 10, maxPct: 20, penalty: -3 },
  "strain.overage.tier2": { minPct: 20, maxPct: 35, penalty: -7 },
  "strain.overage.tier3": { minPct: 35, penalty: -12 },
  "strain.overage.repeated": { thresholdDays: 3, windowDays: 7, extraPenalty: -5 },
  "habits.alcohol.penalty_per_dose": -2,
  "habits.caffeine_at_night.penalty": -1.5,
};

async function main() {
  console.log("Seeding APEX 4…");

  // ── Admin ────────────────────────────────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "fabricioggiacomelli@gmail.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Apex4Admin!2026";

  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        profile: {
          create: {
            displayName: "Admin APEX 4",
            nickname: "admin",
          },
        },
      },
    });
    console.log(`Admin criado: ${adminEmail} / senha: ${adminPassword}`);
  } else {
    console.log(`Admin já existia: ${adminEmail}`);
  }

  // ── Hábitos ──────────────────────────────────────────────────────────────────────────
  for (const habit of HABITS) {
    await db.habit.upsert({
      where: { key: habit.key },
      create: { ...habit, active: true },
      update: { label: habit.label, responseType: habit.responseType, sortOrder: habit.sortOrder },
    });
  }
  const habitsByKey = new Map((await db.habit.findMany()).map((h) => [h.key, h]));

  // ── Versão de pontuação v1 ───────────────────────────────────────────────────────────
  const scoringVersion = await db.scoringVersion.upsert({
    where: { key: "v1" },
    create: { key: "v1", description: "Regras iniciais — ver SCORING.md" },
    update: {},
  });
  for (const [key, value] of Object.entries(SCORING_RULES)) {
    await db.scoringRule.upsert({
      where: { scoringVersionId_key: { scoringVersionId: scoringVersion.id, key } },
      create: { scoringVersionId: scoringVersion.id, key, value: value as never },
      update: { value: value as never },
    });
  }

  // ── Atletas fictícios: apaga e recria (cascade) ─────────────────────────────────────
  const fictionalEmails = ARCHETYPES.map((a) => `${a.key}@apex4.dev`);
  await db.user.deleteMany({ where: { email: { in: fictionalEmails } } });

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - DAYS);

  for (const [athleteIndex, archetype] of ARCHETYPES.entries()) {
    const rng = mulberry32(0x9e3779b9 ^ athleteIndex ^ 42);

    const user = await db.user.create({
      data: {
        email: `${archetype.key}@apex4.dev`,
        passwordHash: await hashPassword("Apex4Demo!2026"),
        role: "PARTICIPANT",
        profile: {
          create: {
            displayName: archetype.displayName,
            nickname: archetype.nickname,
            goalCategory: archetype.goalCategory,
            goalText: archetype.goalText,
            weightKg: round(60 + rng() * 30, 1),
            heightCm: round(160 + rng() * 30, 0),
            birthDate: new Date(1998 + Math.floor(rng() * 8), Math.floor(rng() * 12), 1 + Math.floor(rng() * 27)),
          },
        },
        colorAssignment: { create: { hex: archetype.colorHex } },
        whoopConnection: {
          create: {
            status: "UP_TO_DATE",
            whoopUserId: `mock_${archetype.key}`,
            scopesGranted: [
              "read:recovery",
              "read:cycles",
              "read:sleep",
              "read:workout",
              "read:body_measurement",
              "offline",
            ],
            connectedAt: startDate,
            lastSyncedAt: new Date(),
          },
        },
      },
    });

    console.log(`→ ${archetype.displayName} (${archetype.nickname}) criado, gerando ${DAYS} dias…`);

    // Estado que evolui dia a dia (correlação — ver SCORING.md §12)
    let hrv = archetype.baselineHrv;
    let rhr = archetype.baselineRhr;
    let sleepDebtMin = 0;
    let fatigue = 0; // acumulador de carga recente (proxy simples de ACWR)
    let drankLastNight = false;
    let caffeineLateYesterday = false;
    let highLoadStreak = 0; // dias seguidos de Strain acima do recomendado — ver hrvFatigueSensitivity
    const recentStrains: number[] = [];
    const recentBedtimesMinutes: number[] = []; // pra medir irregularidade de horário de dormir

    for (let day = 0; day < DAYS; day++) {
      const date = new Date(startDate.getTime() + day * DAY_MS);
      const dayOfWeek = date.getDay(); // 0 = domingo
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Deriva de longo prazo: bons hábitos melhoram baseline lentamente ao longo das semanas.
      const weeklyImprovement = (archetype.consistency - 0.5) * 0.01;
      // Fadiga acumulada de 3+ dias seguidos de carga alta bate no HRV — mais forte em quem
      // tem `hrvFatigueSensitivity` alta (história do Theo).
      const hrvFatigueHit = highLoadStreak >= 3 ? (highLoadStreak - 2) * 1.1 * archetype.hrvFatigueSensitivity : 0;
      hrv = clamp(hrv + weeklyImprovement - hrvFatigueHit + (rng() - 0.5) * 1.2, 30, 95);
      rhr = clamp(rhr - weeklyImprovement * 0.6 + hrvFatigueHit * 0.3 + (rng() - 0.5) * 1.0, 40, 80);

      // ── Sono (afetado por álcool/cafeína da noite anterior e dívida acumulada) ────────
      const alcoholPenalty = drankLastNight ? (0.12 + rng() * 0.1) * archetype.alcoholSensitivity : 0;
      const caffeinePenalty = caffeineLateYesterday ? (0.05 + rng() * 0.04) * archetype.caffeineLateSensitivity : 0;
      const consistencyJitter = (1 - archetype.consistency) * (rng() - 0.5) * 90;
      const sleepMinutes = clamp(
        archetype.baselineSleepNeedMin * (1 - alcoholPenalty) - sleepDebtMin * 0.15 + consistencyJitter,
        260,
        560,
      );
      const sleepNeedMin = Math.round(archetype.baselineSleepNeedMin + (rng() - 0.5) * 20);
      sleepDebtMin = clamp(sleepDebtMin + (sleepNeedMin - sleepMinutes) * 0.3, 0, 300);

      const sleepEfficiencyPct = clamp(88 - alcoholPenalty * 60 - caffeinePenalty * 55 + (rng() - 0.5) * 8, 55, 99);
      const sleepPerformancePct = clamp(
        (sleepMinutes / sleepNeedMin) * 100 - alcoholPenalty * 15 - caffeinePenalty * 20,
        30,
        100,
      );
      const remMinutes = Math.round(sleepMinutes * clamp(0.2 - alcoholPenalty * 0.4 + rng() * 0.05, 0.05, 0.28));
      const deepMinutes = Math.round(sleepMinutes * clamp(0.15 + rng() * 0.05, 0.08, 0.22));
      const lightMinutes = Math.max(0, Math.round(sleepMinutes - remMinutes - deepMinutes - 20));
      const disturbanceCount = Math.round((drankLastNight ? 3 : 1) + (caffeineLateYesterday ? 1 : 0) + rng() * 4);

      // Ciclo dorme na "noite anterior" à data competitiva e acorda na manhã da data. O
      // jitter do horário de dormir é ampliado por `bedtimeIrregularityImpact` — história da
      // Manu é ter um horário de dormir bem mais errático que os demais.
      const bedtimeJitterMs =
        Math.round(rng() * 60 * 60 * 1000) * (1 + (1 - archetype.consistency) * archetype.bedtimeIrregularityImpact);
      const sleepStart = new Date(date.getTime() - DAY_MS + 22 * 60 * 60 * 1000 - bedtimeJitterMs);
      const sleepEnd = new Date(sleepStart.getTime() + sleepMinutes * 60 * 1000);

      const bedtimeMinutesOfDay = (sleepStart.getUTCHours() * 60 + sleepStart.getUTCMinutes() + 1440) % 1440;
      const usualBedtime =
        recentBedtimesMinutes.length > 0
          ? recentBedtimesMinutes.reduce((sum, m) => sum + m, 0) / recentBedtimesMinutes.length
          : bedtimeMinutesOfDay;
      const bedtimeDeviationMin = Math.min(180, Math.abs(bedtimeMinutesOfDay - usualBedtime));
      recentBedtimesMinutes.push(bedtimeMinutesOfDay);
      if (recentBedtimesMinutes.length > 14) recentBedtimesMinutes.shift();

      // ── Recovery (afetada por sono da noite + fadiga acumulada + regularidade do horário) ──
      const hrvRelative = hrv / archetype.baselineHrv;
      const rhrRelative = archetype.baselineRhr / rhr;
      const bedtimeIrregularityPenalty = (bedtimeDeviationMin / 60) * 1.8 * archetype.bedtimeIrregularityImpact;
      const recoveryRaw =
        50 +
        (hrvRelative - 1) * 120 +
        (rhrRelative - 1) * 80 +
        (sleepPerformancePct - 75) * 0.35 -
        fatigue * 6 -
        bedtimeIrregularityPenalty +
        (rng() - 0.5) * 8;
      const recoveryScore = clamp(recoveryRaw, 4, 99);
      const recoveryBand = recoveryScore >= 67 ? "green" : recoveryScore >= 34 ? "yellow" : "red";

      // ── Decisão de treino ─────────────────────────────────────────────────────────
      let trainProbability = archetype.trainingFrequency;
      if (archetype.weekendWarrior) trainProbability = isWeekend ? 0.85 : 0.3;
      if (!archetype.overtrainer && recoveryBand === "red") trainProbability *= 0.4;
      if (archetype.overtrainer) trainProbability = clamp(trainProbability + 0.15, 0, 0.95);

      const willTrain = rng() < trainProbability;
      const recommendedMax = recoveryBand === "green" ? 15.5 : recoveryBand === "yellow" ? 12.5 : 9;
      let strain = 0;
      if (willTrain) {
        const overtrainBias = archetype.overtrainer ? 1.15 + rng() * 0.35 : 0.75 + rng() * 0.35;
        strain = clamp(recommendedMax * overtrainBias, 3, 21);
      }

      recentStrains.push(strain);
      if (recentStrains.length > 7) recentStrains.shift();
      // Proxy simples de carga aguda (7 dias) — contribui para a fadiga junto do excesso pontual.
      const acuteLoad = recentStrains.reduce((sum, s) => sum + s, 0);
      const acuteLoadPressure = Math.max(0, acuteLoad / 7 - recommendedMax) * 0.03;
      fatigue = clamp(
        fatigue * 0.7 +
          acuteLoadPressure +
          (strain > recommendedMax ? (strain - recommendedMax) * 0.08 : -0.05),
        0,
        3,
      );
      highLoadStreak = strain > recommendedMax ? highLoadStreak + 1 : 0;

      // ── Journal / hábitos ─────────────────────────────────────────────────────────
      const willDrink = rng() < archetype.alcoholTendency * (isWeekend ? 1.6 : 0.6);
      const alcoholValue = !willDrink
        ? "NONE"
        : rng() < 0.5
          ? "ONE_DRINK"
          : rng() < 0.8
            ? "TWO_DRINKS"
            : "THREE_PLUS";
      drankLastNight = willDrink;

      const waterValue = pick(rng, archetype.consistency, [
        "TARGET_MET",
        "NEAR_TARGET",
        "ABOVE_TARGET",
        "BELOW_TARGET",
      ]);
      const foodValue = pick(rng, archetype.consistency, [
        "ON_PLAN",
        "REASONABLE",
        "EXCELLENT",
        "OFF_PLAN",
      ]);
      const caffeineValue = pick(rng, 0.6, [
        "MORNING_ONLY",
        "UNTIL_AFTERNOON",
        "NONE",
        "AT_NIGHT",
      ]);
      caffeineLateYesterday = caffeineValue === "UNTIL_AFTERNOON" || caffeineValue === "AT_NIGHT";
      const boolValue = (chance: number) => (rng() < chance ? "YES" : rng() < 0.9 ? "NO" : "NOT_APPLICABLE");

      // ── Persistência ─────────────────────────────────────────────────────────────
      const cycle = await db.whoopCycle.create({
        data: {
          userId: user.id,
          externalId: `mock-${archetype.key}-cycle-${day}`,
          startedAt: sleepStart,
          endedAt: new Date(sleepStart.getTime() + DAY_MS),
          strain: round(strain, 1),
        },
      });

      await db.whoopSleep.create({
        data: {
          userId: user.id,
          cycleId: cycle.id,
          externalId: `mock-${archetype.key}-sleep-${day}`,
          startedAt: sleepStart,
          endedAt: sleepEnd,
          sleepPerformancePct: round(sleepPerformancePct),
          sleepEfficiencyPct: round(sleepEfficiencyPct),
          sleepNeedMinutes: sleepNeedMin,
          timeInBedMinutes: Math.round(sleepMinutes / (sleepEfficiencyPct / 100)),
          remMinutes,
          deepMinutes,
          lightMinutes,
          awakeMinutes: Math.max(0, Math.round(sleepMinutes * 0.05)),
          disturbanceCount,
          sleepDebtMinutes: Math.round(sleepDebtMin),
        },
      });

      await db.whoopRecovery.create({
        data: {
          userId: user.id,
          cycleId: cycle.id,
          externalId: `mock-${archetype.key}-recovery-${day}`,
          recoveryScore: round(recoveryScore),
          hrvMs: round(hrv),
          restingHeartRate: round(rhr),
          skinTempCelsius: round(33 + rng() * 1.5),
          spo2Percentage: round(95 + rng() * 3),
        },
      });

      if (willTrain) {
        const workoutStart = new Date(date.getTime() + (7 + rng() * 11) * 60 * 60 * 1000);
        await db.whoopWorkout.create({
          data: {
            userId: user.id,
            externalId: `mock-${archetype.key}-workout-${day}`,
            sportName: pick(rng, 0.5, ["Corrida", "Musculação", "Ciclismo", "Funcional"]),
            startedAt: workoutStart,
            endedAt: new Date(workoutStart.getTime() + (30 + rng() * 60) * 60 * 1000),
            strain: round(strain, 1),
            averageHeartRate: round(120 + rng() * 40, 0),
            maxHeartRate: round(150 + rng() * 40, 0),
            kilojoules: round(1500 + rng() * 3500, 0),
          },
        });
      }

      const journalEntry = await db.journalEntry.create({
        data: {
          userId: user.id,
          referenceDate: date,
          status: "SUBMITTED",
          submittedAt: new Date(date.getTime() + 8 * 60 * 60 * 1000),
          answers: {
            create: [
              { habitId: habitsByKey.get("water")!.id, value: waterValue },
              { habitId: habitsByKey.get("food")!.id, value: foodValue },
              { habitId: habitsByKey.get("alcohol")!.id, value: alcoholValue },
              { habitId: habitsByKey.get("sauna")!.id, value: boolValue(0.1) },
              { habitId: habitsByKey.get("mobility")!.id, value: boolValue(archetype.consistency * 0.5) },
              { habitId: habitsByKey.get("stretching")!.id, value: boolValue(archetype.consistency * 0.4) },
              { habitId: habitsByKey.get("physio")!.id, value: boolValue(0.08) },
              { habitId: habitsByKey.get("meditation")!.id, value: boolValue(archetype.consistency * 0.3) },
              { habitId: habitsByKey.get("caffeine")!.id, value: caffeineValue },
            ],
          },
        },
      });

      await db.dailyPerformance.create({
        data: {
          userId: user.id,
          competitiveDate: date,
          cycleId: cycle.id,
          journalEntryId: journalEntry.id,
          status: "CLOSED",
          closedAt: new Date(date.getTime() + 10 * 60 * 60 * 1000),
        },
      });
    }

    console.log(`  ${DAYS} dias gerados para ${archetype.nickname}.`);
  }

  console.log("Seed concluído.");
}

function pick(rng: () => number, favorFirstWeight: number, options: string[]): string {
  // Quanto maior favorFirstWeight (0..1), mais provável escolher as primeiras opções da lista.
  const roll = rng();
  const biased = roll ** (1 + favorFirstWeight * 2);
  const index = Math.min(options.length - 1, Math.floor(biased * options.length));
  return options[index];
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
