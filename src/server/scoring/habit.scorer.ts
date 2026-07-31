import { ruleValue, round } from "./helpers";
import type { ScorerInput, ScorerResult } from "./types";

const POINTS_POSSIBLE = 5;

const WATER_POINTS: Record<string, number> = {
  TARGET_MET: 1,
  ABOVE_TARGET: 1,
  NEAR_TARGET: 0.6,
  BELOW_TARGET: 0.2,
};

const FOOD_POINTS: Record<string, number> = {
  EXCELLENT: 1,
  ON_PLAN: 0.8,
  REASONABLE: 0.5,
  OFF_PLAN: 0.1,
};

const CAFFEINE_POINTS: Record<string, number> = {
  NONE: 0.5,
  MORNING_ONLY: 0.5,
  UNTIL_AFTERNOON: 0.3,
  AT_NIGHT: 0, // penalidade correspondente é aplicada no SleepScorer, não duplicada aqui
};

const BOOLEAN_HABIT_WEIGHTS: Record<string, number> = {
  mobility: 0.4,
  stretching: 0.3,
  physio: 0.3,
  meditation: 0.3,
  sauna: 0.2,
};

const ALCOHOL_DOSES: Record<string, number> = {
  NONE: 0,
  ONE_DRINK: 1,
  TWO_DRINKS: 2,
  THREE_PLUS: 3,
};

/**
 * Hábitos (5 pts) — sem resposta ao Journal, zero na categoria. Álcool reduz os pontos de
 * hábitos e ainda entra na soma geral (a categoria já soma ao total). Ver SCORING.md §9.
 */
export function scoreHabits({ today, rules }: ScorerInput): ScorerResult {
  if (!today.journalAnswers) {
    return {
      pointsPossible: POINTS_POSSIBLE,
      pointsEarned: 0,
      explanation: "Hábitos: 0 de 5 — Journal não respondido.",
      recommendation: "Responda o Journal amanhã de manhã para pontuar nesta categoria.",
      adjustments: [],
    };
  }

  const answers = today.journalAnswers;
  const adjustments: ScorerResult["adjustments"] = [];

  if (answers.water) {
    adjustments.push({
      type: "BONUS",
      reason: "Água",
      points: WATER_POINTS[answers.water] ?? 0,
      ruleKey: "habits.water",
    });
  }

  if (answers.food) {
    adjustments.push({
      type: "BONUS",
      reason: "Alimentação",
      points: FOOD_POINTS[answers.food] ?? 0,
      ruleKey: "habits.food",
    });
  }

  for (const [key, weight] of Object.entries(BOOLEAN_HABIT_WEIGHTS)) {
    const value = answers[key];
    if (value === "YES") {
      adjustments.push({ type: "BONUS", reason: `Hábito: ${key}`, points: weight, ruleKey: `habits.${key}` });
    }
  }

  if (answers.caffeine) {
    adjustments.push({
      type: "BONUS",
      reason: "Cafeína",
      points: CAFFEINE_POINTS[answers.caffeine] ?? 0,
      ruleKey: "habits.caffeine",
    });
  }

  if (answers.alcohol) {
    const doses = ALCOHOL_DOSES[answers.alcohol] ?? 0;
    if (doses === 0) {
      adjustments.push({ type: "BONUS", reason: "Não consumiu álcool", points: 0.5, ruleKey: "habits.alcohol" });
    } else {
      const perDose = ruleValue(rules, "habits.alcohol.penalty_per_dose", -2) as number;
      adjustments.push({
        type: "PENALTY",
        reason: `Álcool: ${doses} dose(s)`,
        points: round(perDose * doses, 1),
        ruleKey: "habits.alcohol",
      });
    }
  }

  const pointsEarned = round(
    adjustments.reduce((sum, a) => sum + a.points, 0),
    1,
  );

  return {
    pointsPossible: POINTS_POSSIBLE,
    pointsEarned,
    inputValue: answers,
    explanation: `Hábitos: ${pointsEarned} de ${POINTS_POSSIBLE}`,
    recommendation:
      answers.alcohol && answers.alcohol !== "NONE"
        ? "O álcool afetou sua pontuação de hábitos e provavelmente seu sono/Recovery."
        : "Hábitos sob controle — mantenha a rotina.",
    adjustments,
  };
}
