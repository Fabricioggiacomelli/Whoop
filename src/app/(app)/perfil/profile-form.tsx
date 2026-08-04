"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
          <Label htmlFor="displayName">
            Nome <span className="text-apex-recovery-red">*</span>
          </Label>
          <Input id="displayName" name="displayName" defaultValue={displayName} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nickname">
            Apelido <span className="text-apex-recovery-red">*</span>
          </Label>
          <Input id="nickname" name="nickname" defaultValue={nickname} required maxLength={20} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">
          Frase curta <span className="text-apex-text-tertiary">(opcional)</span>
        </Label>
        <Input id="bio" name="bio" defaultValue={bio} maxLength={140} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="birthDate">
          Nascimento <span className="text-apex-text-tertiary">(opcional)</span>
        </Label>
        <Input id="birthDate" name="birthDate" type="date" defaultValue={birthDate} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="weightKg">
            Peso (kg) <span className="text-apex-text-tertiary">(opcional)</span>
          </Label>
          <Input id="weightKg" name="weightKg" type="number" step="0.1" defaultValue={weightKg} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heightCm">
            Altura (cm) <span className="text-apex-text-tertiary">(opcional)</span>
          </Label>
          <Input id="heightCm" name="heightCm" type="number" step="1" defaultValue={heightCm} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="goalText">
          Objetivo pessoal <span className="text-apex-text-tertiary">(opcional)</span>
        </Label>
        <Textarea id="goalText" name="goalText" maxLength={280} defaultValue={goalText} />
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
