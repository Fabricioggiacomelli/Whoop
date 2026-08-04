"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { signOut } from "@/server/auth";
import { revokeConnection } from "@/server/whoop/whoop.auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { todayInAppTimezone } from "@/lib/timezone";

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

/** WHOOP_MODE=live: revoga de verdade via `DELETE /developer/v2/user/access`. */
export async function disconnectWhoopAction() {
  const user = await requireUser();
  await revokeConnection(user.id);
  revalidatePath("/perfil");
}

export async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export type ChangePasswordState = { error: string | null; success?: boolean };

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const isValid = await verifyPassword(dbUser.passwordHash, parsed.data.currentPassword);
  if (!isValid) {
    return { error: "Senha atual incorreta." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  await db.auditLog.create({
    data: { actorId: user.id, action: "user.password_changed", targetType: "User", targetId: user.id },
  });

  revalidatePath("/perfil");
  return { error: null, success: true };
}

const RECOVERY_MODE_TYPES = ["INJURED", "SICK", "GENERAL_RECOVERY"] as const;

export type RecoveryModeState = { error: string | null };

const activateRecoveryModeSchema = z
  .object({
    type: z.enum(RECOVERY_MODE_TYPES),
    reason: z.string().trim().min(3, "Descreva o motivo."),
    endDate: z.string().min(1, "Informe a data de encerramento."),
    limitations: z.string().trim().max(280).optional(),
    allowedActivities: z.string().trim().max(280).optional(),
    forbiddenActivities: z.string().trim().max(280).optional(),
    notes: z.string().trim().max(280).optional(),
  })
  .refine((data) => new Date(data.endDate) > new Date(), {
    message: "A data de encerramento precisa ser no futuro.",
    path: ["endDate"],
  });

export async function activateRecoveryModeAction(
  _prevState: RecoveryModeState,
  formData: FormData,
): Promise<RecoveryModeState> {
  const user = await requireUser();

  const parsed = activateRecoveryModeSchema.safeParse({
    type: formData.get("type"),
    reason: formData.get("reason"),
    endDate: formData.get("endDate"),
    limitations: formData.get("limitations") || undefined,
    allowedActivities: formData.get("allowedActivities") || undefined,
    forbiddenActivities: formData.get("forbiddenActivities") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const startDate = todayInAppTimezone();

  await db.recoveryMode.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      reason: parsed.data.reason,
      startDate,
      endDate: new Date(parsed.data.endDate),
      limitations: parsed.data.limitations,
      allowedActivities: parsed.data.allowedActivities,
      forbiddenActivities: parsed.data.forbiddenActivities,
      notes: parsed.data.notes,
      status: "ACTIVE",
    },
  });

  revalidatePath("/perfil");
  return { error: null };
}

export async function endRecoveryModeAction(recoveryModeId: string) {
  const user = await requireUser();
  await db.recoveryMode.updateMany({
    where: { id: recoveryModeId, userId: user.id, status: { in: ["ACTIVE", "EXTENDED"] } },
    data: { status: "ENDED", endDate: new Date() },
  });
  revalidatePath("/perfil");
}

const extendRecoveryModeSchema = z.object({
  recoveryModeId: z.string().min(1),
  newEndDate: z.string().min(1),
});

export async function extendRecoveryModeAction(formData: FormData) {
  const user = await requireUser();
  const parsed = extendRecoveryModeSchema.safeParse({
    recoveryModeId: formData.get("recoveryModeId"),
    newEndDate: formData.get("newEndDate"),
  });
  if (!parsed.success) return;

  await db.recoveryMode.updateMany({
    where: { id: parsed.data.recoveryModeId, userId: user.id, status: { in: ["ACTIVE", "EXTENDED"] } },
    data: { endDate: new Date(parsed.data.newEndDate), status: "EXTENDED" },
  });
  revalidatePath("/perfil");
}
