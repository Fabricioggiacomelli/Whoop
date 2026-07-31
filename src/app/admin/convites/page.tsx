import type { Metadata } from "next";

import { db } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { CreateInviteForm } from "./create-invite-form";
import { RevokeButton } from "./revoke-button";

export const metadata: Metadata = { title: "Convites" };

function inviteStatus(invite: {
  usedById: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
}) {
  if (invite.usedById) return { label: "Usado", variant: "recoveryGreen" as const };
  if (invite.revokedAt) return { label: "Revogado", variant: "default" as const };
  if (invite.expiresAt < new Date()) return { label: "Expirado", variant: "recoveryYellow" as const };
  return { label: "Pendente", variant: "accent" as const };
}

export default async function ConvitesPage() {
  const invites = await db.invite.findMany({
    orderBy: { createdAt: "desc" },
    include: { usedBy: { include: { profile: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo convite</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateInviteForm />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {invites.length === 0 ? (
          <p className="text-sm text-apex-text-secondary">Nenhum convite gerado ainda.</p>
        ) : (
          invites.map((invite) => {
            const status = inviteStatus(invite);
            return (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-apex-text-primary">{invite.email}</p>
                  <p className="text-xs text-apex-text-tertiary">
                    {invite.usedBy?.profile?.displayName
                      ? `Usado por ${invite.usedBy.profile.displayName}`
                      : `Expira em ${new Intl.DateTimeFormat("pt-BR").format(invite.expiresAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {status.label === "Pendente" ? <RevokeButton inviteId={invite.id} /> : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
