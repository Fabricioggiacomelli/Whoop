import type { RulesMap } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Lê uma regra configurável (ScoringRule.value) com fallback — nunca quebra se a regra não existir. */
export function ruleValue<T>(rules: RulesMap, key: string, fallback: T): T {
  const value = rules.get(key);
  return (value as T | undefined) ?? fallback;
}

/** `null`/`undefined` tratados como "sem dado" — nunca vira 0 silenciosamente. */
export function hasValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
