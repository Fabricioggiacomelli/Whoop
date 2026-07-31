"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { endRecoveryModeAction, extendRecoveryModeAction } from "./actions";

export function RecoveryModeActiveControls({ recoveryModeId }: { recoveryModeId: string }) {
  const [extending, setExtending] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (extending) {
    return (
      <form
        action={(formData) => startTransition(() => extendRecoveryModeAction(formData))}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="recoveryModeId" value={recoveryModeId} />
        <Label htmlFor="newEndDate">Nova data de encerramento</Label>
        <Input id="newEndDate" name="newEndDate" type="date" required />
        <div className="flex gap-2">
          <Button type="submit" variant="accent" size="sm" disabled={isPending}>
            {isPending ? "Salvando…" : "Confirmar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExtending(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setExtending(true)}>
        Estender
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-apex-recovery-red"
        disabled={isPending}
        onClick={() => startTransition(() => endRecoveryModeAction(recoveryModeId))}
      >
        Encerrar agora
      </Button>
    </div>
  );
}
