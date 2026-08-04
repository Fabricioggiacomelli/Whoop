import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Em produção o processo (Vercel) roda em UTC, não no fuso dos usuários — usar
 * `new Date().setHours(0,0,0,0)` direto calcula "hoje" no fuso do SERVIDOR, não no de
 * América/São_Paulo. Isso fica errado por até 3h todo dia (das 21h à meia-noite em SP, o
 * relógio UTC já virou o dia seguinte). Estas funções sempre calculam o dia calendário no
 * fuso configurado (`APP_TIMEZONE`), não no fuso do processo.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

/** Meia-noite (no fuso do app) do dia calendário em que `date` cai. */
export function calendarDateInAppTimezone(date: Date): Date {
  const zoned = toZonedTime(date, APP_TIMEZONE);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, APP_TIMEZONE);
}

/** Meia-noite de hoje no fuso do app. */
export function todayInAppTimezone(): Date {
  return calendarDateInAppTimezone(new Date());
}
