"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { signOut } from "@/server/auth";

export type ProfileState = { error: string | null; success?: boolean };

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome."),
  nickname: z.string().trim().min(2).max(20, "O apelido pode ter no máximo 20 caracteres."),
  bio: z.string().trim().max(140).optional(),
  birthDate: z.string().optional(),
  weightKg: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  heightCm: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  goalText: z.string().trim().max(280).optional(),
});

export async function updateProfileAction(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    nickname: formData.get("nickname"),
    bio: formData.get("bio") || undefined,
    birthDate: formData.get("birthDate") || undefined,
    weightKg: formData.get("weightKg") ?? "",
    heightCm: formData.get("heightCm") ?? "",
    goalText: formData.get("goalText") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await db.profile.update({
      where: { userId: user.id },
      data: {
        displayName: parsed.data.displayName,
        nickname: parsed.data.nickname,
        bio: parsed.data.bio,
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
        weightKg: parsed.data.weightKg,
        heightCm: parsed.data.heightCm,
        goalText: parsed.data.goalText,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: "Esse apelido já está em uso por outro participante." };
    }
    throw error;
  }

  revalidatePath("/perfil");
  return { error: null, success: true };
}

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
      scopesGranted: [
        "read:recovery",
        "read:cycles",
        "read:sleep",
        "read:workout",
        "read:body_measurement",
        "offline",
      ],
    },
    update: { status: "CONNECTED", connectedAt: new Date(), lastSyncedAt: new Date() },
  });

  revalidatePath("/perfil");
}

export async function mockDisconnectWhoopAction() {
  const user = await requireUser();

  await db.whoopConnection.update({
    where: { userId: user.id },
    data: { status: "NOT_CONNECTED", disconnectedAt: new Date() },
  });

  revalidatePath("/perfil");
}

export async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}
