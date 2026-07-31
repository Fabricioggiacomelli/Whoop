"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/server/auth";

export type LoginState = { error: string | null };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/home",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-mail ou senha inválidos." };
    }
    // NEXT_REDIRECT não é um erro real — o Next.js usa exceptions para navegar.
    throw error;
  }
}
