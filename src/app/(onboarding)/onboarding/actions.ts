"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";

export type OnboardingState = { error: string | null };

const GOAL_CATEGORIES = ["SLEEP", "RECOVERY", "STRAIN", "HABITS", "CONSISTENCY", "OTHER"] as const;

const onboardingSchema = z.object({
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  birthDate: z.string().optional(),
  weightKg: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  heightCm: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  goalCategory: z.enum(GOAL_CATEGORIES),
  goalText: z.string().trim().max(280).optional(),
});

export async function completeOnboardingAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const parsed = onboardingSchema.safeParse({
    color: formData.get("color"),
    birthDate: formData.get("birthDate") || undefined,
    weightKg: formData.get("weightKg") ?? "",
    heightCm: formData.get("heightCm") ?? "",
    goalCategory: formData.get("goalCategory"),
    goalText: formData.get("goalText") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existingColor = await db.userColor.findUnique({ where: { hex: parsed.data.color } });
  if (existingColor && existingColor.userId !== user.id) {
    return { error: "Essa cor já foi escolhida por outro participante." };
  }

  await db.$transaction([
    db.userColor.upsert({
      where: { userId: user.id },
      create: { userId: user.id, hex: parsed.data.color },
      update: { hex: parsed.data.color },
    }),
    db.profile.update({
      where: { userId: user.id },
      data: {
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
        weightKg: parsed.data.weightKg,
        heightCm: parsed.data.heightCm,
        goalCategory: parsed.data.goalCategory,
        goalText: parsed.data.goalText,
      },
    }),
    db.whoopConnection.upsert({
      where: { userId: user.id },
      create: { userId: user.id, status: "NOT_CONNECTED" },
      update: {},
    }),
  ]);

  redirect("/onboarding/whoop");
}

/**
 * Conexão WHOOP mockada (WHOOP_MODE=mock) — Fase 3 substitui por OAuth real.
 * Ver WHOOP_INTEGRATION.md.
 */
export async function mockConnectWhoopAction() {
  const user = await requireUser();

  await db.whoopConnection.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: "CONNECTED",
      whoopUserId: `mock_${user.id.slice(0, 8)}`,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      scopesGranted: ["read:recovery", "read:cycles", "read:sleep", "read:workout", "read:body_measurement", "offline"],
    },
    update: {
      status: "CONNECTED",
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });

  redirect("/home");
}
