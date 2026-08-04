"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { completeGoalAction, deleteGoalAction, pauseGoalAction, resumeGoalAction } from "./actions";

export function GoalActionButtons({ goalId, status }: { goalId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" ? (
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(() => pauseGoalAction(goalId))}
        >
          Pausar
        </Button>
      ) : null}
      {status === "PAUSED" ? (
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(() => resumeGoalAction(goalId))}
        >
          Retomar
        </Button>
      ) : null}
      {status === "ACTIVE" || status === "PAUSED" ? (
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(() => completeGoalAction(goalId))}
        >
          Concluir
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="text-apex-recovery-red"
        disabled={isPending}
        onClick={() => startTransition(() => deleteGoalAction(goalId))}
      >
        Encerrar
      </Button>
    </div>
  );
}
