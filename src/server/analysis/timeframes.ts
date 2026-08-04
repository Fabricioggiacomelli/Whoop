import { todayInAppTimezone } from "@/lib/timezone";

/**
 * Períodos oferecidos no MVP da Análise. Baselines (7/14/30/60/90) cobrem as janelas
 * pedidas na spec; 6 meses/1 ano/desde-sempre ficam pra fase 2 (ver relatório final).
 */
export const ANALYSIS_PERIODS = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "14", label: "14 dias", days: 14 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "60", label: "60 dias", days: 60 },
  { key: "90", label: "90 dias", days: 90 },
] as const;

export type AnalysisPeriodKey = (typeof ANALYSIS_PERIODS)[number]["key"];

export function resolveAnalysisPeriod(key: string | undefined): (typeof ANALYSIS_PERIODS)[number] {
  return ANALYSIS_PERIODS.find((p) => p.key === key) ?? ANALYSIS_PERIODS[2];
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export type DateRange = { from: Date; to: Date };

/**
 * Range do período atual (últimos `days` dias, incluindo hoje) e o range imediatamente
 * anterior de mesmo tamanho — usado pra comparação automática de período.
 */
export function currentAndPreviousRange(days: number): { current: DateRange; previous: DateRange } {
  const today = todayInAppTimezone();
  const current: DateRange = { from: addDays(today, -(days - 1)), to: today };
  const previous: DateRange = { from: addDays(current.from, -days), to: addDays(current.from, -1) };
  return { current, previous };
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
