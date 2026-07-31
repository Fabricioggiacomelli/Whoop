import type { Metadata } from "next";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { generateSuggestionsForUser, getGoalProgressPercent } from "@/server/services/goal.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { CreateGoalForm } from "./create-goal-form";
import { SuggestionCard } from "./suggestion-card";
import { GoalActionButtons } from "./goal-actions-buttons";

export const metadata: Metadata = { title: "Metas" };

const CATEGORY_LABELS: Record<string, string> = {
  SLEEP: "Sono",
  RECOVERY: "Recovery",
  STRAIN: "Strain",
  HABITS: "Hábitos",
  CONSISTENCY: "Consistência",
  OTHER: "Outro",
};

export default async function MetasPage() {
  const user = await requireUser();

  await generateSuggestionsForUser(user.id);

  const [activeGoals, pausedGoals, suggestions, history] = await Promise.all([
    db.goal.findMany({ where: { userId: user.id, status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "desc" } }),
    db.goal.findMany({ where: { userId: user.id, status: "PAUSED", deletedAt: null }, orderBy: { createdAt: "desc" } }),
    db.goalSuggestion.findMany({ where: { userId: user.id, resolvedAt: null }, orderBy: { createdAt: "desc" } }),
    db.goal.findMany({
      where: { userId: user.id, status: { in: ["COMPLETED", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const activeWithProgress = await Promise.all(
    [...activeGoals, ...pausedGoals].map(async (goal) => ({
      goal,
      progress: await getGoalProgressPercent(goal),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-apex-text-primary">Metas</h1>
      </div>

      {suggestions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-apex-text-secondary">Sugeridas pelo sistema</h2>
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={{
                id: s.id,
                title: s.title,
                rationale: s.rationale,
                targetValue: s.targetValue ? Number(s.targetValue) : null,
              }}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-apex-text-secondary">Ativas</h2>
        </div>

        {activeWithProgress.length === 0 ? (
          <p className="text-sm text-apex-text-secondary">Nenhuma meta ativa ainda.</p>
        ) : (
          activeWithProgress.map(({ goal, progress }) => (
            <Card key={goal.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-apex-text-primary">{goal.title}</CardTitle>
                <Badge variant={goal.status === "ACTIVE" ? "accent" : "default"}>
                  {goal.status === "ACTIVE" ? CATEGORY_LABELS[goal.category] : "Pausada"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="h-2 overflow-hidden rounded-full bg-apex-surface-raised">
                  <div
                    className="h-full rounded-full bg-apex-accent transition-all"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <p className="text-xs text-apex-text-tertiary">
                  {progress.toFixed(0)}% do ciclo de {goal.cycleLengthDays} dias
                  {goal.targetValue ? ` · alvo: ${Number(goal.targetValue)}` : ""}
                </p>
                <GoalActionButtons goalId={goal.id} status={goal.status} />
              </CardContent>
            </Card>
          ))
        )}

        <CreateGoalForm />
      </section>

      {history.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-apex-text-secondary">Histórico</h2>
          {history.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-surface px-3.5 py-2.5 text-sm"
            >
              <span className="text-apex-text-secondary">{goal.title}</span>
              <Badge variant={goal.status === "COMPLETED" ? "recoveryGreen" : "default"}>
                {goal.status === "COMPLETED" ? "Concluída" : "Encerrada"}
              </Badge>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
