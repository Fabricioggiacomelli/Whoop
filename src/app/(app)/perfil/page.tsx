import type { Metadata } from "next";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ProfileForm } from "./profile-form";
import { mockConnectWhoopAction, mockDisconnectWhoopAction, signOutAction } from "./actions";

export const metadata: Metadata = { title: "Perfil" };

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

function toDateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function PerfilPage() {
  const sessionUser = await requireUser();

  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: { profile: true, colorAssignment: true, whoopConnection: true },
  });

  const connectionStatus = user.whoopConnection?.status ?? "NOT_CONNECTED";
  const isConnected = connectionStatus !== "NOT_CONNECTED";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span
          className="size-12 shrink-0 rounded-full border border-apex-border"
          style={{ backgroundColor: user.colorAssignment?.hex ?? "#242933" }}
          aria-hidden="true"
        />
        <div>
          <h1 className="text-lg font-semibold text-apex-text-primary">
            {user.profile?.displayName}
          </h1>
          <p className="text-sm text-apex-text-secondary">@{user.profile?.nickname}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            displayName={user.profile?.displayName ?? ""}
            nickname={user.profile?.nickname ?? ""}
            bio={user.profile?.bio ?? ""}
            birthDate={toDateInputValue(user.profile?.birthDate)}
            weightKg={user.profile?.weightKg?.toString() ?? ""}
            heightCm={user.profile?.heightCm?.toString() ?? ""}
            goalText={user.profile?.goalText ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Conexão WHOOP</CardTitle>
          <Badge variant={CONNECTION_BADGE[connectionStatus]}>
            {CONNECTION_LABEL[connectionStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-apex-text-tertiary">
            Modo mock ativo (WHOOP_MODE=mock) — nenhuma credencial real é usada até a Fase 3.
          </p>
          {isConnected ? (
            <form action={mockDisconnectWhoopAction}>
              <Button type="submit" variant="outline" size="sm">
                Desconectar
              </Button>
            </form>
          ) : (
            <form action={mockConnectWhoopAction}>
              <Button type="submit" variant="accent" size="sm">
                Conectar WHOOP
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modo recuperação</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-apex-text-secondary">
          Ativação (lesionado, doente ou recuperação geral) chega na Fase 2, junto com o ajuste
          da engine de pontuação. Ver SCORING.md §10.
        </CardContent>
      </Card>

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="w-full text-apex-recovery-red">
          Sair da conta
        </Button>
      </form>
    </div>
  );
}
