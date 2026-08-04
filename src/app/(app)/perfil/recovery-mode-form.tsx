"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import { activateRecoveryModeAction, type RecoveryModeState } from "./actions";

const initialState: RecoveryModeState = { error: null };

const TYPE_OPTIONS = [
  { value: "INJURED", label: "Lesionado" },
  { value: "SICK", label: "Doente" },
  { value: "GENERAL_RECOVERY", label: "Recuperação geral" },
] as const;

export function RecoveryModeForm() {
  const [state, formAction, isPending] = useActionState(activateRecoveryModeAction, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ativar modo recuperação
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Tipo</Label>
        <Select id="type" name="type" defaultValue="GENERAL_RECOVERY">
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">Motivo</Label>
        <Input id="reason" name="reason" required placeholder="Ex: dor no joelho" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="endDate">Data de encerramento</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="limitations">Limitações (opcional)</Label>
        <Input id="limitations" name="limitations" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="allowedActivities">Atividades permitidas (opcional)</Label>
        <Input id="allowedActivities" name="allowedActivities" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="forbiddenActivities">Atividades proibidas (opcional)</Label>
        <Input id="forbiddenActivities" name="forbiddenActivities" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Input id="notes" name="notes" />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-apex-recovery-red">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={isPending}>
          {isPending ? "Ativando…" : "Ativar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
