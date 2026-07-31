import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { requireUser } from "@/server/services/auth-guard";
import {
  ALL_TIME_KEY,
  getLatestPeriodKey,
  getPreviousPeriodKey,
  getRanking,
} from "@/server/services/ranking.service";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RankingScope } from "@/generated/prisma/enums";

import { ScopeTabs } from "./scope-tabs";

export const metadata: Metadata = { title: "Ranking" };

const SCOPE_MAP: Record<string, RankingScope> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  geral: "ALL_TIME",
};

const SCOPE_LABELS: Record<RankingScope, string> = {
  DAILY: "Ranking do dia",
  WEEKLY: "Ranking da semana",
  MONTHLY: "Ranking do mês",
  ALL_TIME: "Ranking geral (desde o lançamento)",
};

function periodLabel(scope: RankingScope, periodKey: string) {
  if (scope === "ALL_TIME") return "Desde o lançamento";
  if (scope === "DAILY") {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(
      new Date(`${periodKey}T12:00:00`),
    );
  }
  if (scope === "MONTHLY") {
    const [year, month] = periodKey.split("-");
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
      new Date(Number(year), Number(month) - 1, 1),
    );
  }
  return periodKey.replace("-W", " · Semana ");
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireUser();
  const { scope: scopeParam } = await searchParams;
  const scopeKey = scopeParam && SCOPE_MAP[scopeParam] ? scopeParam : "daily";
  const scope = SCOPE_MAP[scopeKey];

  const periodKey = scope === "ALL_TIME" ? ALL_TIME_KEY : await getLatestPeriodKey(scope);

  if (!periodKey) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-apex-text-primary">Ranking</h1>
        <ScopeTabs current={scopeKey} />
        <Card className="p-5 text-sm text-apex-text-secondary">
          Ainda não há dados suficientes para este ranking.
        </Card>
      </div>
    );
  }

  const [rows, previousPeriodKey] = await Promise.all([
    getRanking(scope, periodKey),
    getPreviousPeriodKey(scope, periodKey),
  ]);

  const previousRows = previousPeriodKey ? await getRanking(scope, previousPeriodKey) : [];
  const previousPositionByUser = new Map(previousRows.map((r) => [r.userId, r.position]));

  const leaderPoints = rows[0]?.points ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-apex-text-primary">Ranking</h1>
      <ScopeTabs current={scopeKey} />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
          {SCOPE_LABELS[scope]}
        </p>
        <p className="text-sm text-apex-text-secondary">{periodLabel(scope, periodKey)}</p>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const prevPosition = previousPositionByUser.get(row.userId);
          const trend = prevPosition ? prevPosition - row.position : 0;
          const gap = row.position === 1 ? null : leaderPoints - row.points;
          const isMe = row.userId === user.id;

          const content = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border border-apex-border bg-apex-surface px-4 py-3.5 transition-colors",
                isMe && "border-apex-accent/50 bg-apex-accent/5",
              )}
            >
              <span className="apex-numeric w-5 shrink-0 text-center text-sm font-semibold text-apex-text-tertiary">
                {row.position}
              </span>
              <span
                className="size-9 shrink-0 rounded-full border border-apex-border"
                style={{ backgroundColor: row.colorHex ?? "#242933" }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-apex-text-primary">
                  {row.nickname}
                  {isMe ? <span className="ml-1.5 text-xs text-apex-text-tertiary">(você)</span> : null}
                </p>
                {gap !== null ? (
                  <p className="text-xs text-apex-text-tertiary">-{gap.toFixed(1)} do 1º</p>
                ) : (
                  <p className="text-xs text-apex-recovery-green">Líder</p>
                )}
              </div>
              <span className="apex-numeric text-base font-semibold text-apex-text-primary">
                {row.points.toFixed(1)}
              </span>
              <span className="w-4 shrink-0">
                {trend > 0 ? (
                  <ArrowUp className="size-4 text-apex-recovery-green" aria-label="Subiu" />
                ) : trend < 0 ? (
                  <ArrowDown className="size-4 text-apex-recovery-red" aria-label="Caiu" />
                ) : (
                  <Minus className="size-4 text-apex-text-tertiary" aria-label="Estável" />
                )}
              </span>
            </div>
          );

          return scope === "DAILY" ? (
            <Link key={row.userId} href={`/ranking/${periodKey}/score?userId=${row.userId}`}>
              {content}
            </Link>
          ) : (
            <div key={row.userId}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
