"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

import { approveSuggestionAction, rejectSuggestionAction, type GoalFormState } from "./actions";

const initialState: GoalFormState = { error: null };

export function SuggestionCard({
  suggestion,
}: {
  suggestion: { id: string; title: string; rationale: string | null; targetValue: number | null };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(approveSuggestionAction, initialState);
  const [isRejecting, startRejectTransition] = useTransition();

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div>
          <p className="text-sm font-medium text-apex-text-primary">{suggestion.title}</p>
          {suggestion.rationale ? (
            <p className="mt-1 text-xs text-apex-text-secondary">{suggestion.rationale}</p>
          ) : null}
        </div>

        {editing ? (
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="suggestionId" value={suggestion.id} />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`title-${suggestion.id}`}>Título</Label>
              <Input id={`title-${suggestion.id}`} name="title" defaultValue={suggestion.title} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`target-${suggestion.id}`}>Valor-alvo</Label>
              <Input
                id={`target-${suggestion.id}`}
                name="targetValue"
                type="number"
                step="0.1"
                defaultValue={suggestion.targetValue ?? undefined}
              />
            </div>
            <input type="hidden" name="cycleLengthDays" value={14} />
            {state.error ? <p className="text-sm text-apex-recovery-red">{state.error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="accent" size="sm" disabled={isPending}>
                {isPending ? "Aprovando…" : "Confirmar"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <form action={formAction}>
              <input type="hidden" name="suggestionId" value={suggestion.id} />
              <input type="hidden" name="title" value={suggestion.title} />
              <input type="hidden" name="targetValue" value={suggestion.targetValue ?? ""} />
              <input type="hidden" name="cycleLengthDays" value={14} />
              <Button type="submit" variant="accent" size="sm" disabled={isPending}>
                {isPending ? "Aprovando…" : "Aprovar"}
              </Button>
            </form>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-apex-recovery-red"
              disabled={isRejecting}
              onClick={() => startRejectTransition(() => rejectSuggestionAction(suggestion.id))}
            >
              Rejeitar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
