"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createInviteAction, type CreateInviteState } from "./actions";

const initialState: CreateInviteState = { error: null };

export function CreateInviteForm() {
  const [state, formAction, isPending] = useActionState(createInviteAction, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="email">E-mail do convidado</Label>
          <Input id="email" name="email" type="email" required placeholder="amigo@email.com" />
        </div>
        <Button type="submit" variant="accent" disabled={isPending}>
          {isPending ? "Gerando…" : "Gerar convite"}
        </Button>
      </form>

      {state.error ? <p className="text-sm text-apex-recovery-red">{state.error}</p> : null}

      {state.inviteUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-apex-border bg-apex-surface-raised px-3 py-2.5 text-sm">
          <code className="flex-1 truncate text-apex-text-primary">{state.inviteUrl}</code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(state.inviteUrl ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
