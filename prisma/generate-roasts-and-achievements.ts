/**
 * Gera provocações determinísticas para todo o histórico e avalia conquistas.
 * Rodar depois de `backfill-scores` + `recompute-rankings`.
 *
 * Rodar com: npm run generate-roasts
 */
import "dotenv/config";

import { db } from "@/server/db";
import { generateRoastForUser } from "@/server/services/roast.service";
import { evaluateAllAchievements } from "@/server/services/achievement.service";

async function main() {
  const users = await db.user.findMany({ where: { role: "PARTICIPANT" }, select: { id: true, email: true } });

  for (const user of users) {
    const days = await db.dailyScore.findMany({
      where: { userId: user.id },
      orderBy: { competitiveDate: "asc" },
      select: { competitiveDate: true },
    });

    console.log(`→ ${user.email}: gerando ${days.length} provocações…`);
    for (const day of days) {
      await generateRoastForUser(user.id, day.competitiveDate);
    }
  }

  console.log("Avaliando conquistas…");
  await evaluateAllAchievements();

  console.log("Concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
