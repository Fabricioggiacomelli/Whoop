import { db } from "@/server/db";
import { todayInAppTimezone as todayLocalMidnight } from "@/lib/timezone";

/**
 * Encerramento automático na data definida (brief §20) — sem um worker/cron dedicado na
 * Fase 2, o encerramento é aplicado de forma preguiçosa (lazy) sempre que o modo é lido.
 * Nunca "congela o campeonato": a engine continua rodando com o modo ativo até esse ponto.
 */
export async function getActiveRecoveryMode(userId: string) {
  const active = await db.recoveryMode.findFirst({
    where: { userId, status: { in: ["ACTIVE", "EXTENDED"] } },
    orderBy: { startDate: "desc" },
  });

  if (!active) return null;

  if (active.endDate < todayLocalMidnight()) {
    return db.recoveryMode.update({ where: { id: active.id }, data: { status: "ENDED" } });
  }

  return active;
}

export async function getRecoveryModeHistory(userId: string) {
  return db.recoveryMode.findMany({ where: { userId }, orderBy: { startDate: "desc" } });
}
