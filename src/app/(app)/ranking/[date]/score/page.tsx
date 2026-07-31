import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Detalhe da pontuação" };

const CATEGORY_LABELS: Record<string, string> = {
  SLEEP: "Sono",
  RECOVERY: "Recovery",
  STRAIN: "Treino e Strain",
  CONSISTENCY: "Consistência",
  EVOLUTION: "Evolução pessoal",
  HABITS: "Hábitos",
};

const CATEGORY_ORDER = ["SLEEP", "RECOVERY", "STRAIN", "CONSISTENCY", "EVOLUTION", "HABITS"];

export default async function ScoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ userId?: string }>;
}) {
  const sessionUser = await requireUser();
  const { date } = await params;
  const { userId: userIdParam } = await searchParams;
  const userId = userIdParam ?? sessionUser.id;

  const competitiveDate = new Date(`${date}T00:00:00.000Z`);

  const dailyScore = await db.dailyScore.findFirst({
    where: { userId, competitiveDate },
    include: {
      components: { include: { adjustments: true } },
      user: { include: { profile: true, colorAssignment: true } },
    },
  });

  if (!dailyScore) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/ranking" className="inline-flex items-center gap-1 text-sm text-apex-text-secondary">
          <ChevronLeft className="size-4" /> Voltar ao ranking
        </Link>
        <Card className="p-5 text-sm text-apex-text-secondary">
          Nenhum cálculo disponível para este dia ainda.
        </Card>
      </div>
    );
  }

  const componentsByCategory = new Map(dailyScore.components.map((c) => [c.category, c]));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/ranking" className="inline-flex items-center gap-1 text-sm text-apex-text-secondary">
        <ChevronLeft className="size-4" /> Voltar ao ranking
      </Link>

      <header className="flex items-center gap-3">
        <span
          className="size-11 shrink-0 rounded-full border border-apex-border"
          style={{ backgroundColor: dailyScore.user.colorAssignment?.hex ?? "#242933" }}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm text-apex-text-secondary">
            {dailyScore.user.profile?.nickname} ·{" "}
            {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(competitiveDate)}
          </p>
          <p className="apex-numeric text-3xl font-semibold text-apex-text-primary">
            {Number(dailyScore.totalPoints).toFixed(1)} pts
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {CATEGORY_ORDER.map((category) => {
          const component = componentsByCategory.get(category as never);
          if (!component) return null;

          return (
            <details key={category} className="group rounded-xl border border-apex-border bg-apex-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5">
                <span className="text-sm font-medium text-apex-text-primary">
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="apex-numeric text-sm font-semibold text-apex-text-secondary">
                  {Number(component.pointsEarned).toFixed(1)} de {Number(component.pointsPossible).toFixed(0)}
                </span>
              </summary>
              <CardContent className="flex flex-col gap-3 border-t border-apex-border pt-4">
                <div className="flex flex-col gap-1.5">
                  {component.adjustments.map((adj) => (
                    <div key={adj.id} className="flex items-center justify-between text-sm">
                      <span className="text-apex-text-secondary">{adj.reason}</span>
                      <Badge variant={Number(adj.points) >= 0 ? "recoveryGreen" : "recoveryRed"}>
                        {Number(adj.points) >= 0 ? "+" : ""}
                        {Number(adj.points).toFixed(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
                {component.recommendation ? (
                  <p className="rounded-lg bg-apex-surface-raised px-3 py-2.5 text-xs text-apex-text-secondary">
                    {component.recommendation}
                  </p>
                ) : null}
              </CardContent>
            </details>
          );
        })}
      </div>
    </div>
  );
}
