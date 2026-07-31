"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { revokeInviteAction } from "./actions";

export function RevokeButton({ inviteId }: { inviteId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-apex-recovery-red"
      disabled={isPending}
      onClick={() => startTransition(() => revokeInviteAction(inviteId))}
    >
      {isPending ? "Revogando…" : "Revogar"}
    </Button>
  );
}
