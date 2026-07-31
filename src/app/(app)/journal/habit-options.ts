import type { HabitResponseType } from "@/generated/prisma/enums";

export const HABIT_OPTIONS: Record<HabitResponseType, Array<{ value: string; label: string }>> = {
  BOOLEAN_NA: [
    { value: "YES", label: "Sim" },
    { value: "NO", label: "Não" },
    { value: "NOT_APPLICABLE", label: "Não se aplica" },
  ],
  SCALE_WATER: [
    { value: "BELOW_TARGET", label: "Abaixo da meta" },
    { value: "NEAR_TARGET", label: "Próximo da meta" },
    { value: "TARGET_MET", label: "Meta atingida" },
    { value: "ABOVE_TARGET", label: "Acima da meta" },
  ],
  SCALE_FOOD: [
    { value: "OFF_PLAN", label: "Fora do planejado" },
    { value: "REASONABLE", label: "Razoável" },
    { value: "ON_PLAN", label: "Dentro do planejado" },
    { value: "EXCELLENT", label: "Excelente" },
  ],
  SCALE_ALCOHOL: [
    { value: "NONE", label: "Não consumi" },
    { value: "ONE_DRINK", label: "1 dose" },
    { value: "TWO_DRINKS", label: "2 doses" },
    { value: "THREE_PLUS", label: "3 ou mais" },
  ],
  SCALE_CAFFEINE: [
    { value: "NONE", label: "Não consumi" },
    { value: "MORNING_ONLY", label: "Somente pela manhã" },
    { value: "UNTIL_AFTERNOON", label: "Até a tarde" },
    { value: "AT_NIGHT", label: "À noite" },
  ],
};
