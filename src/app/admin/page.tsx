import Link from "next/link";
import type { Metadata } from "next";

import { db } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminOverviewPage() {
  const [userCount, pendingInvites, connectedCount] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.invite.count({ where: { usedById: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.whoopConnection.count({ where: { status: { not: "NOT_CONNECTED" } } }),
  ]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Participantes</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold text-apex-text-primary">
          {userCount}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Convites pendentes</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold text-apex-text-primary">
          {pendingInvites}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>WHOOP conectados</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold text-apex-text-primary">
          {connectedCount}
        </CardContent>
      </Card>

      <p className="col-span-3 text-sm text-apex-text-secondary">
        Parâmetros de pontuação, logs, status de sincronização e configuração do telão chegam
        junto das fases que os alimentam (2 a 4) — ver{" "}
        <Link href="/admin/usuarios" className="text-apex-text-primary underline">
          usuários
        </Link>{" "}
        e{" "}
        <Link href="/admin/convites" className="text-apex-text-primary underline">
          convites
        </Link>{" "}
        já disponíveis.
      </p>
    </div>
  );
}
