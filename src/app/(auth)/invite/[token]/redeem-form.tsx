"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { redeemInviteAction, type RedeemState } from "./actions";

const initialState: RedeemState = { error: null };

export function RedeemForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(redeemInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-2">
        <Label>E-mail convidado</Label>
        <p className="text-sm text-apex-text-primary">{email}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Nome</Label>
        <Input id="displayName" name="displayName" required autoComplete="name" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">Apelido</Label>
        <Input id="nickname" name="nickname" required maxLength={20} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Criar senha</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="passwordConfirm">Confirmar senha</Label>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-apex-recovery-red">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={isPending} className="mt-1">
        {isPending ? "Criando conta…" : "Criar minha conta"}
      </Button>
    </form>
  );
}
