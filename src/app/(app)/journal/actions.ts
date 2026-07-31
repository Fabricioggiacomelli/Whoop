"use server";

import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";

export type SubmitJournalState = { error: string | null };

function todayLocalMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function submitJournalAction(
  answers: Record<string, string>,
): Promise<SubmitJournalState> {
  const user = await requireUser();

  const habits = await db.habit.findMany({ where: { active: true } });
  const missing = habits.filter((h) => !answers[h.key]);
  if (missing.length > 0) {
    return { error: `Faltam respostas: ${missing.map((h) => h.label).join(", ")}` };
  }

  const referenceDate = todayLocalMidnight();

  await db.$transaction(async (tx) => {
    const entry = await tx.journalEntry.upsert({
      where: { userId_referenceDate: { userId: user.id, referenceDate } },
      create: { userId: user.id, referenceDate, status: "SUBMITTED", submittedAt: new Date() },
      update: { status: "SUBMITTED", submittedAt: new Date() },
    });

    await tx.journalAnswer.deleteMany({ where: { journalEntryId: entry.id } });
    await tx.journalAnswer.createMany({
      data: habits.map((h) => ({
        journalEntryId: entry.id,
        habitId: h.id,
        value: answers[h.key],
      })),
    });
  });

  redirect("/journal?submitted=1");
}
