"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { completeOnboardingAction, type OnboardingState } from "./actions";
import { COLOR_PALETTE } from "./color-palette";

const GOAL_OPTIONS = [
  { value: "SLEEP", label: "Dormir melhor" },
  { value: "RECOVERY", label: "Recuperar melhor" },
  { value: "STRAIN", label: "Treinar com mais consistência" },
  { value: "HABITS", label: "Melhorar hábitos" },
  { value: "CONSISTENCY", label: "Ser mais consistente" },
  { value: "OTHER", label: "Outro" },
] as const;

const initialState: OnboardingState = { error: null };

export function OnboardingForm({ takenColors }: { takenColors: string[] }) {
  const [state, formAction, isPending] = useActionState(completeOnboardingAction, initialState);
  const [selectedColor, setSelectedColor] = useState<string>(
    COLOR_PALETTE.find((c) => !takenColors.includes(c.hex))?.hex ?? COLOR_PALETTE[0].hex,
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="color" value={selectedColor} />

      <section className="flex flex-col gap-3">
        <Label>Sua cor</Label>
        <div className="flex flex-wrap gap-3">
          {COLOR_PALETTE.map(({ hex, name }) => {
            const isTaken = takenColors.includes(hex) && hex !== selectedColor;
            return (
              <button
                key={hex}
                type="button"
                title={name}
                disabled={isTaken}
                onClick={() => setSelectedColor(hex)}
                className={cn(
                  "size-11 rounded-full transition-transform duration-150",
                  isTaken && "cursor-not-allowed opacity-25",
                  selectedColor === hex && "ring-2 ring-offset-2 ring-offset-apex-bg scale-105",
                )}
                style={{ backgroundColor: hex, ...(selectedColor === hex ? { boxShadow: `0 0 0 2px ${hex}` } : {}) }}
              />
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" />
        </div>
        <div />
        <div className="flex flex-col gap-2">
          <Label htmlFor="weightKg">Peso (kg)</Label>
          <Input id="weightKg" name="weightKg" type="number" step="0.1" min="0" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heightCm">Altura (cm)</Label>
          <Input id="heightCm" name="heightCm" type="number" step="1" min="0" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Label>Seu objetivo principal</Label>
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map((goal) => (
            <label
              key={goal.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-apex-border bg-apex-surface-raised px-3 py-2.5 text-sm text-apex-text-secondary has-[:checked]:border-apex-accent has-[:checked]:text-apex-text-primary"
            >
              <input
                type="radio"
                name="goalCategory"
                value={goal.value}
                defaultChecked={goal.value === "CONSISTENCY"}
                className="accent-apex-accent"
              />
              {goal.label}
            </label>
          ))}
        </div>
        <textarea
          name="goalText"
          maxLength={280}
          placeholder="Descreva seu objetivo em uma frase (opcional)"
          className="min-h-20 rounded-lg border border-apex-border bg-apex-surface-raised px-3.5 py-2.5 text-sm text-apex-text-primary placeholder:text-apex-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent"
        />
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-apex-recovery-red">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={isPending}>
        {isPending ? "Salvando…" : "Continuar"}
      </Button>
    </form>
  );
}
