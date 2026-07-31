import type { Metadata } from "next";

import { db } from "@/server/db";
import { requireAdmin } from "@/server/services/auth-guard";
import { Badge } from "@/components/ui/badge";

import { StatusToggle } from "./status-toggle";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { profile: true, colorAssignment: true, whoopConnection: true },
  });

  return (
    <div className="flex flex-col gap-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              className="size-8 shrink-0 rounded-full border border-apex-border"
              style={{ backgroundColor: user.colorAssignment?.hex ?? "#242933" }}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-apex-text-primary">
                {user.profile?.displayName ?? user.email}
                {user.role === "ADMIN" ? (
                  <span className="ml-2 text-xs text-apex-text-tertiary">admin</span>
                ) : null}
              </p>
              <p className="text-xs text-apex-text-tertiary">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={user.status === "ACTIVE" ? "recoveryGreen" : "recoveryRed"}>
              {user.status === "ACTIVE" ? "Ativo" : "Suspenso"}
            </Badge>
            {user.id !== admin.id ? (
              <StatusToggle userId={user.id} status={user.status} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
