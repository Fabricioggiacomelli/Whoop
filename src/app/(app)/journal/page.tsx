import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { Card, CardContent } from "@/components/ui/card";

import { JournalFlow } from "./journal-flow";
import { HABIT_OPTIONS } from "./habit-options";

export const metadata: Metadata = { title: "Journal" };

function todayLocalMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireUser();
  const { submitted } = await searchParams;

  const habits = await db.habit.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

  const todayEntry = await db.journalEntry.findUnique({
    where: { userId_referenceDate: { userId: user.id, referenceDate: todayLocalMidnight() } },
  });

  const alreadySubmitted = todayEntry?.status === "SUBMITTED";

  const history = await db.journalEntry.findMany({
    where: { userId: user.id, status: "SUBMITTED" },
    orderBy: { referenceDate: "desc" },
    take: 7,
    include: { answers: { include: { habit: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      {!alreadySubmitted ? (
        <JournalFlow habits={habits} />
      ) : (
        <Card className="border-apex-recovery-green/30 bg-apex-recovery-green/5">
          <CardContent className="flex items-center gap-3 pt-5">
            <CheckCircle2 className="size-5 shrink-0 text-apex-recovery-green" />
            <p className="text-sm text-apex-text-primary">
              {submitted ? "Journal enviado!" : "Você já respondeu o Journal de hoje."}
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-apex-text-secondary">Histórico</h2>
          {history.map((entry) => (
            <details key={entry.id} className="rounded-lg border border-apex-border bg-apex-surface">
              <summary className="cursor-pointer list-none px-3.5 py-2.5 text-sm text-apex-text-primary">
                {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
                  entry.referenceDate,
                )}
              </summary>
              <div className="flex flex-col gap-1 border-t border-apex-border px-3.5 py-2.5">
                {entry.answers.map((a) => {
                  const option = HABIT_OPTIONS[a.habit.responseType].find((o) => o.value === a.value);
                  return (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-apex-text-tertiary">{a.habit.label}</span>
                      <span className="text-apex-text-secondary">{option?.label ?? a.value}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
