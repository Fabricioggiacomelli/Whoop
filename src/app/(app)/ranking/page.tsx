import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crown, Minus } from "lucide-react";

import { requireUser } from "@/server/services/auth-guard";
import { calendarDateInAppTimezone, todayInAppTimezone } from "@/lib/timezone";
import {
  ALL_TIME_KEY,
  dailyPeriodKey,
  getLatestPeriodKey,
  getLiveDailyRanking,
  getPreviousPeriodKey,
  getRanking,
  type RankingRow,
} from "@/server/services/ranking.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaggerList } from "@/components/ui/stagger-list";
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

const DAILY_NAV_WINDOW_DAYS = 7;

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

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; day?: string }>;
}) {
  const user = await requireUser();
  const { scope: scopeParam, day: dayParam } = await searchParams;
  const scopeKey = scopeParam && SCOPE_MAP[scopeParam] ? scopeParam : "daily";
  const scope = SCOPE_MAP[scopeKey];

  if (scope === "DAILY") {
    const today = todayInAppTimezone();
    const oldestNavigable = addDaysLocal(today, -(DAILY_NAV_WINDOW_DAYS - 1));

    let selectedDate = dayParam ? calendarDateInAppTimezone(new Date(`${dayParam}T12:00:00Z`)) : today;
    if (Number.isNaN(selectedDate.getTime()) || selectedDate > today || selectedDate < oldestNavigable) {
      selectedDate = today;
    }

    const selectedKey = dailyPeriodKey(selectedDate);
    const todayKey = dailyPeriodKey(today);
    const isToday = selectedKey === todayKey;

    const previousDate = addDaysLocal(selectedDate, -1);
    const previousKey = dailyPeriodKey(previousDate);

    const [rows, previousRows] = await Promise.all([
      isToday ? getLiveDailyRanking(selectedDate) : getRanking("DAILY", selectedKey),
      getRanking("DAILY", previousKey),
    ]);

    const previousPositionByUser = new Map(previousRows.map((r) => [r.userId, r.position]));
    const leaderPoints = rows[0]?.points ?? 0;

    const canGoBack = selectedDate > oldestNavigable;
    const canGoForward = selectedDate < today;
    const backHref = `/ranking?scope=daily&day=${dailyPeriodKey(addDaysLocal(selectedDate, -1))}`;
    const forwardHref = `/ranking?scope=daily&day=${dailyPeriodKey(addDaysLocal(selectedDate, 1))}`;

    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold text-apex-text-primary">Ranking</h1>
        <ScopeTabs current={scopeKey} />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
              {SCOPE_LABELS.DAILY}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-apex-text-secondary">{periodLabel("DAILY", selectedKey)}</p>
              {isToday ? <Badge variant="recoveryYellow">Em andamento</Badge> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canGoBack ? (
              <Link
                href={backHref}
                className="flex size-11 items-center justify-center rounded-lg border border-apex-border text-apex-text-secondary transition-colors hover:text-apex-text-primary"
                aria-label="Dia anterior"
              >
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span className="flex size-11 items-center justify-center rounded-lg border border-apex-border text-apex-text-tertiary/40">
                <ChevronLeft className="size-4" />
              </span>
            )}
            {canGoForward ? (
              <Link
                href={forwardHref}
                className="flex size-11 items-center justify-center rounded-lg border border-apex-border text-apex-text-secondary transition-colors hover:text-apex-text-primary"
                aria-label="Próximo dia"
              >
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className="flex size-11 items-center justify-center rounded-lg border border-apex-border text-apex-text-tertiary/40">
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <Card className="p-5 text-sm text-apex-text-secondary">
            {isToday ? "Ainda não há dados de hoje." : "Sem dados para esse dia."}
          </Card>
        ) : (
          <StaggerList className="flex flex-col gap-2">
            {rows.map((row) => (
              <DailyRow
                key={row.userId}
                row={row}
                isMe={row.userId === user.id}
                leaderPoints={leaderPoints}
                trend={
                  previousPositionByUser.has(row.userId)
                    ? previousPositionByUser.get(row.userId)! - row.position
                    : 0
                }
                periodKey={selectedKey}
              />
            ))}
          </StaggerList>
        )}
      </div>
    );
  }

  const periodKey = scope === "ALL_TIME" ? ALL_TIME_KEY : await getLatestPeriodKey(scope);

  if (!periodKey) {
    return (
      <div className="flex flex-col gap-5">
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
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-apex-text-primary">Ranking</h1>
      <ScopeTabs current={scopeKey} />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
          {SCOPE_LABELS[scope]}
        </p>
        <p className="text-sm text-apex-text-secondary">{periodLabel(scope, periodKey)}</p>
      </div>

      <StaggerList className="flex flex-col gap-2">
        {rows.map((row) => {
          const prevPosition = previousPositionByUser.get(row.userId);
          const trend = prevPosition ? prevPosition - row.position : 0;
          const isMe = row.userId === user.id;

          return (
            <DailyRow
              key={row.userId}
              row={row}
              isMe={isMe}
              leaderPoints={leaderPoints}
              trend={trend}
              periodKey={periodKey}
              linkToDetail={scope === "WEEKLY" || scope === "MONTHLY" || scope === "ALL_TIME" ? false : true}
            />
          );
        })}
      </StaggerList>
    </div>
  );
}

function DailyRow({
  row,
  isMe,
  leaderPoints,
  trend,
  periodKey,
  linkToDetail = true,
}: {
  row: RankingRow & { inProgress?: boolean };
  isMe: boolean;
  leaderPoints: number;
  trend: number;
  periodKey: string;
  linkToDetail?: boolean;
}) {
  const gap = row.position === 1 ? null : leaderPoints - row.points;
  const isLeader = row.position === 1;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-apex-border bg-apex-surface px-4 py-3.5 transition-colors",
        isMe && "border-apex-accent/50 bg-apex-accent/5",
        isLeader && "apex-card-premium",
      )}
    >
      <span
        className={cn(
          "apex-numeric flex w-6 shrink-0 items-center justify-center text-sm font-semibold",
          isLeader ? "text-apex-accent-2" : "text-apex-text-tertiary",
        )}
      >
        {isLeader ? <Crown className="size-4" aria-hidden="true" /> : row.position}
      </span>
      <span
        className={cn(
          "size-9 shrink-0 rounded-full border",
          isLeader ? "border-apex-accent-2/60 shadow-[0_0_12px_-2px_var(--apex-accent-2)]" : "border-apex-border",
        )}
        style={{ backgroundColor: row.colorHex ?? "#242933" }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-apex-text-primary">
          {row.nickname}
          {isMe ? <span className="text-xs text-apex-text-tertiary">(você)</span> : null}
          {row.inProgress ? (
            <span className="size-1.5 shrink-0 rounded-full bg-apex-recovery-yellow" title="Em andamento" />
          ) : null}
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

  if (linkToDetail && !row.inProgress) {
    return (
      <Link key={row.userId} href={`/ranking/${periodKey}/score?userId=${row.userId}`}>
        {content}
      </Link>
    );
  }

  return <div key={row.userId}>{content}</div>;
}
