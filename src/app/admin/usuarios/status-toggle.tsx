"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { toggleUserStatusAction } from "./actions";

export function StatusToggle({ userId, status }: { userId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={status === "ACTIVE" ? "text-apex-recovery-red" : "text-apex-recovery-green"}
      disabled={isPending}
      onClick={() => startTransition(() => toggleUserStatusAction(userId))}
    >
      {status === "ACTIVE" ? "Suspender" : "Reativar"}
    </Button>
  );
}
