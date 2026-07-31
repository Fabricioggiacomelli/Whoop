"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createGoalAction, type GoalFormState } from "./actions";

const initialState: GoalFormState = { error: null };

const CATEGORY_OPTIONS = [
  { value: "SLEEP", label: "Sono" },
  { value: "RECOVERY", label: "Recovery" },
  { value: "STRAIN", label: "Strain" },
  { value: "HABITS", label: "Hábitos" },
  { value: "CONSISTENCY", label: "Consistência" },
  { value: "OTHER", label: "Outro" },
] as const;

export function CreateGoalForm() {
  const [state, formAction, isPending] = useActionState(createGoalAction, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="self-start">
        + Nova meta
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-apex-border bg-apex-surface p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required placeholder="Ex: Dormir 8h por 14 dias" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Categoria</Label>
          <select
            id="category"
            name="category"
            defaultValue="OTHER"
            className="h-11 rounded-lg border border-apex-border bg-apex-surface-raised px-3 text-sm text-apex-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cycleLengthDays">Ciclo (dias)</Label>
          <Input id="cycleLengthDays" name="cycleLengthDays" type="number" defaultValue={14} min={1} max={90} />
        </div>
      </div>

      <input type="hidden" name="metric" value="custom" />

      <div className="flex flex-col gap-2">
        <Label htmlFor="targetValue">Valor-alvo (opcional)</Label>
        <Input id="targetValue" name="targetValue" type="number" step="0.1" placeholder="Opcional" />
      </div>

      {state.error ? <p className="text-sm text-apex-recovery-red">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="accent" size="sm" disabled={isPending}>
          {isPending ? "Criando…" : "Criar meta"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
