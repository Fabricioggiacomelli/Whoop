/**
 * Materializa RankingSnapshot (diário/semanal/mensal/geral) a partir de tudo que existe em
 * DailyScore. Rodar depois de `backfill-scores` ou de qualquer reprocessamento.
 *
 * Rodar com: npm run recompute-rankings
 */
import "dotenv/config";

import { format, startOfMonth, startOfWeek } from "date-fns";

import { db } from "@/server/db";
import {
  recomputeAllTimeRanking,
  recomputeDailyRanking,
  recomputeMonthlyRanking,
  recomputeWeeklyRanking,
} from "@/server/services/ranking.service";

async function main() {
  const dates = await db.dailyScore.findMany({
    select: { competitiveDate: true },
    distinct: ["competitiveDate"],
    orderBy: { competitiveDate: "asc" },
  });

  console.log(`Recalculando rankings para ${dates.length} dias distintos…`);

  const seenWeeks = new Set<string>();
  const seenMonths = new Set<string>();

  for (const { competitiveDate } of dates) {
    await recomputeDailyRanking(competitiveDate);

    const weekKey = format(startOfWeek(competitiveDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (!seenWeeks.has(weekKey)) {
      seenWeeks.add(weekKey);
      await recomputeWeeklyRanking(competitiveDate);
    }

    const monthKey = format(startOfMonth(competitiveDate), "yyyy-MM");
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      await recomputeMonthlyRanking(competitiveDate);
    }
  }

  await recomputeAllTimeRanking();

  console.log(
    `Rankings recalculados: ${dates.length} diários, ${seenWeeks.size} semanais, ${seenMonths.size} mensais, 1 geral.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
