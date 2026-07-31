"use server";

import { z } from "zod";

import { redeemInvite, InviteError } from "@/server/services/invite.service";
import { signIn } from "@/server/auth";

export type RedeemState = { error: string | null };

const redeemSchema = z.object({
  token: z.string().min(1),
  displayName: z.string().trim().min(2, "Informe seu nome."),
  nickname: z
    .string()
    .trim()
    .min(2, "O apelido precisa ter ao menos 2 caracteres.")
    .max(20, "O apelido pode ter no máximo 20 caracteres."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  passwordConfirm: z.string(),
});

export async function redeemInviteAction(
  _prevState: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const parsed = redeemSchema.safeParse({
    token: formData.get("token"),
    displayName: formData.get("displayName"),
    nickname: formData.get("nickname"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return { error: "As senhas não coincidem." };
  }

  try {
    const user = await redeemInvite({
      token: parsed.data.token,
      password: parsed.data.password,
      displayName: parsed.data.displayName,
      nickname: parsed.data.nickname,
    });

    await signIn("credentials", {
      email: user.email,
      password: parsed.data.password,
      redirectTo: "/onboarding",
    });

    return { error: null };
  } catch (error) {
    if (error instanceof InviteError) {
      return { error: error.message };
    }
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
}
