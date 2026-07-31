"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateProfileAction, type ProfileState } from "./actions";

const initialState: ProfileState = { error: null };

export function ProfileForm({
  displayName,
  nickname,
  bio,
  birthDate,
  weightKg,
  heightCm,
  goalText,
}: {
  displayName: string;
  nickname: string;
  bio: string;
  birthDate: string;
  weightKg: string;
  heightCm: string;
  goalText: string;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">Nome</Label>
          <Input id="displayName" name="displayName" defaultValue={displayName} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nickname">Apelido</Label>
          <Input id="nickname" name="nickname" defaultValue={nickname} required maxLength={20} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">Frase curta</Label>
        <Input id="bio" name="bio" defaultValue={bio} maxLength={140} placeholder="Opcional" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="birthDate">Nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={birthDate} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="weightKg">Peso (kg)</Label>
          <Input id="weightKg" name="weightKg" type="number" step="0.1" defaultValue={weightKg} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heightCm">Altura (cm)</Label>
          <Input id="heightCm" name="heightCm" type="number" step="1" defaultValue={heightCm} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="goalText">Objetivo pessoal</Label>
        <textarea
          id="goalText"
          name="goalText"
          maxLength={280}
          defaultValue={goalText}
          className="min-h-20 rounded-lg border border-apex-border bg-apex-surface-raised px-3.5 py-2.5 text-sm text-apex-text-primary placeholder:text-apex-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-apex-recovery-red">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-apex-recovery-green">Perfil atualizado.</p> : null}

      <Button type="submit" variant="accent" disabled={isPending} className="self-start">
        {isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
