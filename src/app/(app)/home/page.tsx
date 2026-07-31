import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Home" };

const CONNECTION_LABEL: Record<string, string> = {
  NOT_CONNECTED: "Não conectado",
  CONNECTED: "Conectado",
  IMPORTING_HISTORY: "Importando histórico",
  SYNCING: "Sincronizando",
  UP_TO_DATE: "Atualizado",
  AWAITING_DATA: "Aguardando dados",
  AUTH_ERROR: "Erro de autenticação",
  TEMP_ERROR: "Erro temporário",
  RECONNECT_REQUIRED: "Reconexão necessária",
};

const CONNECTION_BADGE: Record<string, BadgeProps["variant"]> = {
  NOT_CONNECTED: "default",
  CONNECTED: "recoveryGreen",
  IMPORTING_HISTORY: "accent",
  SYNCING: "accent",
  UP_TO_DATE: "recoveryGreen",
  AWAITING_DATA: "recoveryYellow",
  AUTH_ERROR: "recoveryRed",
  TEMP_ERROR: "recoveryYellow",
  RECONNECT_REQUIRED: "recoveryRed",
};

export default async function HomePage() {
  const sessionUser = await requireUser();

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    include: { profile: true, colorAssignment: true, whoopConnection: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (!user.profile?.goalCategory || !user.colorAssignment) {
    redirect("/onboarding");
  }

  const connectionStatus = user.whoopConnection?.status ?? "NOT_CONNECTED";
  const otherAthletes = await db.user.count({ where: { id: { not: user.id }, deletedAt: null } });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span
          className="size-11 shrink-0 rounded-full border border-apex-border"
          style={{ backgroundColor: user.colorAssignment.hex }}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm text-apex-text-secondary">Olá,</p>
          <h1 className="text-lg font-semibold text-apex-text-primary">
            {user.profile?.displayName ?? user.email}
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Conexão WHOOP</CardTitle>
          <Badge variant={CONNECTION_BADGE[connectionStatus]}>
            {CONNECTION_LABEL[connectionStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connectionStatus === "NOT_CONNECTED" ? (
            <>
              <p className="text-sm text-apex-text-secondary">
                Conecte sua WHOOP para começar a pontuar.
              </p>
              <Button asChild variant="accent" size="sm" className="self-start">
                <Link href="/onboarding/whoop">Conectar WHOOP</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-apex-text-secondary">
              Última sincronização:{" "}
              {user.whoopConnection?.lastSyncedAt
                ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                    user.whoopConnection.lastSyncedAt,
                  )
                : "—"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sua nota de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="apex-numeric text-4xl font-semibold text-apex-text-primary">—</p>
          <p className="mt-2 text-sm text-apex-text-secondary">
            A engine de pontuação (sono, Recovery, Strain, consistência, evolução, hábitos)
            chega na Fase 2. Ver <span className="text-apex-text-primary">SCORING.md</span>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grupo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-apex-text-secondary">
          Você e mais {otherAthletes} atleta{otherAthletes === 1 ? "" : "s"} competindo no APEX 4.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal, ranking, provocações e conquistas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-apex-text-secondary">
          Chegam na Fase 2, sobre os dados simulados dos 4 atletas (seed de 90 dias). A
          fundação — conta, convite, perfil, WHOOP mockado e navegação — já está pronta.
        </CardContent>
      </Card>
    </div>
  );
}
