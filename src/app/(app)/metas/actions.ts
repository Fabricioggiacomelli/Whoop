"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";

export type GoalFormState = { error: string | null };

const GOAL_CATEGORIES = ["SLEEP", "RECOVERY", "STRAIN", "HABITS", "CONSISTENCY", "OTHER"] as const;

const createGoalSchema = z.object({
  title: z.string().trim().min(3, "Dê um título para a meta."),
  metric: z.string().trim().min(1),
  targetValue: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  category: z.enum(GOAL_CATEGORIES),
  cycleLengthDays: z.coerce.number().int().min(1).max(90).default(14),
});

export async function createGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();

  const parsed = createGoalSchema.safeParse({
    title: formData.get("title"),
    metric: formData.get("metric"),
    targetValue: formData.get("targetValue") ?? "",
    category: formData.get("category"),
    cycleLengthDays: formData.get("cycleLengthDays") || 14,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await db.goal.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      metric: parsed.data.metric,
      targetValue: parsed.data.targetValue,
      category: parsed.data.category,
      cycleLengthDays: parsed.data.cycleLengthDays,
      cycleStartDate: new Date(),
      source: "USER",
      status: "ACTIVE",
    },
  });

  revalidatePath("/metas");
  return { error: null };
}

const approveSuggestionSchema = z.object({
  suggestionId: z.string().min(1),
  title: z.string().trim().min(3),
  targetValue: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  cycleLengthDays: z.coerce.number().int().min(1).max(90).default(14),
});

export async function approveSuggestionAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();

  const parsed = approveSuggestionSchema.safeParse({
    suggestionId: formData.get("suggestionId"),
    title: formData.get("title"),
    targetValue: formData.get("targetValue") ?? "",
    cycleLengthDays: formData.get("cycleLengthDays") || 14,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const suggestion = await db.goalSuggestion.findFirst({
    where: { id: parsed.data.suggestionId, userId: user.id, resolvedAt: null },
  });
  if (!suggestion) {
    return { error: "Sugestão não encontrada ou já resolvida." };
  }

  await db.$transaction(async (tx) => {
    const goal = await tx.goal.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        metric: suggestion.metric,
        targetValue: parsed.data.targetValue ?? suggestion.targetValue,
        category: suggestion.category,
        cycleLengthDays: parsed.data.cycleLengthDays,
        cycleStartDate: new Date(),
        source: "SYSTEM_SUGGESTED",
        status: "ACTIVE",
      },
    });

    await tx.goalSuggestion.update({
      where: { id: suggestion.id },
      data: { resolvedAt: new Date(), resultingGoalId: goal.id },
    });
  });

  revalidatePath("/metas");
  return { error: null };
}

export async function rejectSuggestionAction(suggestionId: string) {
  const user = await requireUser();
  await db.goalSuggestion.updateMany({
    where: { id: suggestionId, userId: user.id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/metas");
}

async function setGoalStatus(goalId: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") {
  const user = await requireUser();
  await db.goal.updateMany({
    where: { id: goalId, userId: user.id },
    data: { status },
  });
  revalidatePath("/metas");
}

export async function pauseGoalAction(goalId: string) {
  await setGoalStatus(goalId, "PAUSED");
}

export async function resumeGoalAction(goalId: string) {
  await setGoalStatus(goalId, "ACTIVE");
}

export async function completeGoalAction(goalId: string) {
  await setGoalStatus(goalId, "COMPLETED");
}

export async function deleteGoalAction(goalId: string) {
  const user = await requireUser();
  await db.goal.updateMany({
    where: { id: goalId, userId: user.id },
    data: { deletedAt: new Date(), status: "REJECTED" },
  });
  revalidatePath("/metas");
}
