/**
 * Roda a engine de pontuação sobre todo o histórico já fechado (seed de 90 dias ou dados
 * reais futuros). Idempotente — pode rodar de novo a qualquer momento após mudar regras.
 *
 * Rodar com: npm run backfill-scores
 */
import "dotenv/config";

import { db } from "@/server/db";
import { computeDailyScore } from "@/server/scoring/engine";

async function main() {
  const users = await db.user.findMany({
    where: { deletedAt: null, role: "PARTICIPANT" },
    select: { id: true, email: true },
  });

  let total = 0;

  for (const user of users) {
    const days = await db.dailyPerformance.findMany({
      where: { userId: user.id, status: { in: ["CLOSED", "REPROCESSED"] } },
      orderBy: { competitiveDate: "asc" },
      select: { competitiveDate: true },
    });

    console.log(`→ ${user.email}: ${days.length} dias a calcular…`);

    for (const day of days) {
      await computeDailyScore({ userId: user.id, competitiveDate: day.competitiveDate });
      total += 1;
    }
  }

  console.log(`Backfill concluído: ${total} dias pontuados para ${users.length} atletas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
