import type { Metadata } from "next";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoreCategory } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Categorias" };

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  SLEEP: "Sono",
  RECOVERY: "Recovery",
  STRAIN: "Strain adequado",
  CONSISTENCY: "Consistência",
  EVOLUTION: "Evolução",
  HABITS: "Hábitos",
};

const CATEGORY_ORDER: ScoreCategory[] = ["SLEEP", "RECOVERY", "STRAIN", "CONSISTENCY", "EVOLUTION", "HABITS"];

async function getCategoryChampions() {
  const users = await db.user.findMany({
    where: { role: "PARTICIPANT" },
    include: { profile: true, colorAssignment: true },
  });
  const userIds = users.map((u) => u.id);

  // Uma consulta por categoria (paralelas), não uma por (categoria × usuário) — a versão
  // anterior fazia 6×N consultas sequenciais, lento sob a latência de um Postgres remoto.
  const results = await Promise.all(
    CATEGORY_ORDER.map(async (category) => {
      const components = await db.scoreComponent.findMany({
        where: { category, dailyScore: { userId: { in: userIds } } },
        select: { pointsEarned: true, dailyScore: { select: { userId: true } } },
      });

      const totals = new Map<string, { sum: number; count: number }>();
      for (const component of components) {
        const userId = component.dailyScore.userId;
        const entry = totals.get(userId) ?? { sum: 0, count: 0 };
        entry.sum += Number(component.pointsEarned);
        entry.count += 1;
        totals.set(userId, entry);
      }

      let best: { userId: string; avg: number } | null = null;
      for (const [userId, { sum, count }] of totals) {
        const avg = sum / count;
        if (!best || avg > best.avg) best = { userId, avg };
      }
      if (!best) return null;

      const user = users.find((u) => u.id === best!.userId);
      return {
        category,
        nickname: user?.profile?.nickname ?? "—",
        colorHex: user?.colorAssignment?.hex ?? null,
        avgPoints: Math.round(best.avg * 10) / 10,
      };
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

export default async function CategoriasPage() {
  await requireUser();

  const [champions, groupAchievements] = await Promise.all([
    getCategoryChampions(),
    db.userAchievement.findMany({
      where: { periodLabel: "historico" },
      include: { achievement: true, user: { include: { profile: true, colorAssignment: true } } },
      orderBy: { earnedAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-apex-text-primary">Categorias</h1>

      <section className="grid grid-cols-2 gap-3">
        {champions.map((champ) => (
          <Card key={champ.category}>
            <CardHeader>
              <CardTitle>{CATEGORY_LABELS[champ.category]}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 pt-0">
              <span
                className="size-7 shrink-0 rounded-full border border-apex-border"
                style={{ backgroundColor: champ.colorHex ?? "#242933" }}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-apex-text-primary">{champ.nickname}</p>
                <p className="apex-numeric text-xs text-apex-text-tertiary">{champ.avgPoints} pts média</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {groupAchievements.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-apex-text-secondary">Títulos do grupo</h2>
          <div className="grid grid-cols-2 gap-3">
            {groupAchievements.map((grant) => (
              <Card key={grant.id}>
                <CardContent className="flex flex-col items-center gap-1.5 py-4 text-center">
                  <span className="text-2xl">{grant.achievement.icon}</span>
                  <p className="text-sm font-medium text-apex-text-primary">{grant.achievement.name}</p>
                  <p className="text-xs text-apex-text-tertiary">{grant.user.profile?.nickname}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
