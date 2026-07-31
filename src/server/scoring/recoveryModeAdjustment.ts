import type { RecoveryModeInfo } from "./types";

export type RecoveryModeProfileAdjustment = {
  /** Multiplica a faixa recomendada de Strain — nunca aumenta, só reduz a meta. */
  strainCeilingMultiplier: number;
  /** Em modo recuperação, descanso/atividade leve conta como decisão correta para consistência. */
  treatRestAsGoodConsistency: boolean;
  /** Texto explicativo opcional exibido junto ao componente afetado. */
  note: string | null;
};

/**
 * Único ponto de tradução "modo recuperação → parâmetros dos scorers" (SCORING.md §10).
 * Não é rodado como um passo isolado sobre o resultado final — cada scorer relevante
 * (Strain, Consistência) consulta isto para ajustar seus próprios critérios.
 */
export function getRecoveryModeAdjustment(recoveryMode: RecoveryModeInfo): RecoveryModeProfileAdjustment {
  if (!recoveryMode) {
    return { strainCeilingMultiplier: 1, treatRestAsGoodConsistency: false, note: null };
  }

  switch (recoveryMode.type) {
    case "INJURED":
      return {
        strainCeilingMultiplier: 0.35,
        treatRestAsGoodConsistency: true,
        note: "Modo recuperação (lesão) ativo — meta de Strain reduzida.",
      };
    case "SICK":
      return {
        strainCeilingMultiplier: 0.3,
        treatRestAsGoodConsistency: true,
        note: "Modo recuperação (doença) ativo — priorize descanso.",
      };
    case "GENERAL_RECOVERY":
      return {
        strainCeilingMultiplier: 0.65,
        treatRestAsGoodConsistency: true,
        note: "Modo recuperação geral ativo — carga reduzida.",
      };
    default:
      return { strainCeilingMultiplier: 1, treatRestAsGoodConsistency: false, note: null };
  }
}
