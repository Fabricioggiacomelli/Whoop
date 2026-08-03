import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Flame, MessageSquareWarning, Sparkles } from "lucide-react";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { getHomeSummary } from "@/server/services/home.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const CONNECTION_LABEL: Record<string, string> = {
  NOT_CONNECTED: "Não conectado",
  CONNECTED: "Conectado",
  IMPORTING_HISTORY: "Importando histórico",
  SYNCING: "Sincronizando",
  UP_TO_DATE: "Atualizado",
  AWAITING_DATA: "Aguardando dados",
  AUTH_ERROR: "Erro de autenticação",
  TEMP_ERROR: "Erro temporário",
  RECONNECT_REQUIRED: "Reconexão necessária",
};

const CONNECTION_BADGE: Record<string, BadgeProps["variant"]> = {
  NOT_CONNECTED: "default",
  CONNECTED: "recoveryGreen",
  IMPORTING_HISTORY: "accent",
  SYNCING: "accent",
  UP_TO_DATE: "recoveryGreen",
  AWAITING_DATA: "recoveryYellow",
  AUTH_ERROR: "recoveryRed",
  TEMP_ERROR: "recoveryYellow",
  RECONNECT_REQUIRED: "recoveryRed",
};

function recoveryBadgeVariant(score: number | null): BadgeProps["variant"] {
  if (score == null) return "default";
  if (score >= 67) return "recoveryGreen";
  if (score >= 34) return "recoveryYellow";
  return "recoveryRed";
}

export default async function HomePage() {
  const sessionUser = await requireUser();

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    include: { profile: true, colorAssignment: true, whoopConnection: true },
  });

  if (!user) redirect("/login");
  if (!user.profile?.goalCategory || !user.colorAssignment) redirect("/onboarding");

  const connectionStatus = user.whoopConnection?.status ?? "NOT_CONNECTED";
  const summary = await getHomeSummary(user.id);
  const score = summary.today;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span
          className="size-11 shrink-0 rounded-full border border-apex-border"
          style={{ backgroundColor: user.colorAssignment.hex }}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm text-apex-text-secondary">Olá,</p>
          <h1 className="text-lg font-semibold text-apex-text-primary">
            {user.profile?.displayName ?? user.email}
          </h1>
        </div>
      </header>

      {summary.journalPendingToday ? (
        <Link href="/journal">
          <Card className="border-apex-accent/40 bg-apex-accent/5 transition-colors hover:bg-apex-accent/10">
            <CardContent className="flex items-center justify-between pt-5">
              <div>
                <p className="text-sm font-medium text-apex-text-primary">Journal de hoje pendente</p>
                <p className="text-xs text-apex-text-secondary">Responda para pontuar em Hábitos.</p>
              </div>
              <Button variant="accent" size="sm">
                Responder
              </Button>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      {score ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>
              {score.inProgress ? "Hoje" : "Sua nota"} —{" "}
              {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
                score.competitiveDate,
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {score.inProgress ? <Badge variant="recoveryYellow">Em andamento</Badge> : null}
              {score.streak > 0 ? (
                <Badge variant="accent">
                  <Flame className="size-3.5" /> {score.streak}d
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {score.inProgress ? (
              <p className="text-sm text-apex-text-secondary">
                Seu ciclo de hoje ainda não terminou — a nota final aparece quando você dormir
                e a WHOOP fechar o dia.
              </p>
            ) : (
              <div className="flex items-end justify-between">
                <Link href={`/ranking/${score.competitiveDate.toISOString().slice(0, 10)}/score?userId=${user.id}`}>
                  <p className="apex-numeric text-5xl font-semibold text-apex-text-primary">
                    {score.totalPoints?.toFixed(1)}
                  </p>
                </Link>
                <div className="text-right">
                  <p className="apex-numeric text-lg font-semibold text-apex-text-primary">
                    {score.position ? `${score.position}º` : "—"}
                    <span className="text-sm font-normal text-apex-text-tertiary">
                      /{score.totalAthletes}
                    </span>
                  </p>
                  <p className="text-xs text-apex-text-tertiary">
                    {score.pointsBehindLeader != null
                      ? `-${score.pointsBehindLeader.toFixed(1)} do 1º`
                      : "Líder do dia"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-apex-border bg-apex-surface-raised p-3">
                <p className="text-xs text-apex-text-tertiary">Recovery</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="apex-numeric text-lg font-semibold text-apex-text-primary">
                    {score.recoveryScore != null ? Math.round(score.recoveryScore) : "—"}
                  </span>
                  {score.recoveryScore != null ? (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        recoveryBadgeVariant(score.recoveryScore) === "recoveryGreen" && "bg-apex-recovery-green",
                        recoveryBadgeVariant(score.recoveryScore) === "recoveryYellow" && "bg-apex-recovery-yellow",
                        recoveryBadgeVariant(score.recoveryScore) === "recoveryRed" && "bg-apex-recovery-red",
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border border-apex-border bg-apex-surface-raised p-3">
                <p className="text-xs text-apex-text-tertiary">Sleep Perf.</p>
                <p className="apex-numeric mt-1 text-lg font-semibold text-apex-text-primary">
                  {score.sleepPerformancePct != null ? `${Math.round(score.sleepPerformancePct)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-apex-border bg-apex-surface-raised p-3">
                <p className="text-xs text-apex-text-tertiary">
                  Strain{score.inProgress ? " (parcial)" : ""}
                </p>
                <p className="apex-numeric mt-1 text-lg font-semibold text-apex-text-primary">
                  {score.trained ? score.strain?.toFixed(1) : "—"}
                </p>
              </div>
            </div>

            {score.strainMin != null && score.strainMax != null ? (
              <div className="flex items-center justify-between rounded-lg bg-apex-surface-raised px-3 py-2.5 text-xs text-apex-text-secondary">
                <span>
                  Faixa recomendada daquele dia: {score.strainMin}–{score.strainMax} de Strain
                </span>
              </div>
            ) : null}

            {score.overtrainingRisk ? (
              <div className="flex items-center gap-2 rounded-lg bg-apex-recovery-red/10 px-3 py-2.5 text-xs text-apex-recovery-red">
                <AlertTriangle className="size-4 shrink-0" />
                Você passou da faixa recomendada de Strain — risco de overtraining.
              </div>
            ) : null}

            {summary.weeklyPoints != null ? (
              <p className="text-xs text-apex-text-tertiary">
                Semana: {summary.weeklyPoints.toFixed(1)} pts
                {summary.weeklyPosition ? ` · ${summary.weeklyPosition}º lugar` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-apex-text-secondary">
            Aguardando dados de hoje — assim que a WHOOP sincronizar seu ciclo, aparece aqui.
          </CardContent>
        </Card>
      )}

      {summary.roastText ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-apex-recovery-yellow" />
            <p className="text-sm text-apex-text-primary">{summary.roastText}</p>
          </CardContent>
        </Card>
      ) : null}

      {summary.recentAchievements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Conquistas recentes</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 pt-0">
            {summary.recentAchievements.map((a) => (
              <div
                key={`${a.key}-${a.earnedAt.toISOString()}`}
                className="flex flex-col items-center gap-1 rounded-lg border border-apex-border bg-apex-surface-raised px-3 py-2.5"
                title={a.name}
              >
                <span className="text-xl">{a.icon}</span>
                <span className="max-w-16 truncate text-center text-[11px] text-apex-text-secondary">
                  {a.name}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Conexão WHOOP</CardTitle>
          <Badge variant={CONNECTION_BADGE[connectionStatus]}>{CONNECTION_LABEL[connectionStatus]}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connectionStatus === "NOT_CONNECTED" ? (
            <>
              <p className="text-sm text-apex-text-secondary">Conecte sua WHOOP para começar a pontuar.</p>
              <Button asChild variant="accent" size="sm" className="self-start">
                <Link href="/onboarding/whoop">
                  <Sparkles className="size-4" /> Conectar WHOOP
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-apex-text-secondary">
              Última sincronização:{" "}
              {user.whoopConnection?.lastSyncedAt
                ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                    user.whoopConnection.lastSyncedAt,
                  )
                : "—"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
