"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/services/auth-guard";
import { createInvite, revokeInvite } from "@/server/services/invite.service";

export type CreateInviteState = { error: string | null; inviteUrl?: string };

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.");

export async function createInviteAction(
  _prevState: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const admin = await requireAdmin();

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const invite = await createInvite({ createdById: admin.id, email: parsed.data });

  revalidatePath("/admin/convites");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { error: null, inviteUrl: `${appUrl}/invite/${invite.token}` };
}

export async function revokeInviteAction(inviteId: string) {
  const admin = await requireAdmin();
  await revokeInvite(inviteId, admin.id);
  revalidatePath("/admin/convites");
}
