import Link from "next/link";
import type { Metadata } from "next";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

import { getActiveRecoveryMode, getRecoveryModeHistory } from "@/server/services/recoveryMode.service";

import { ProfileForm } from "./profile-form";
import { RecoveryModeForm } from "./recovery-mode-form";
import { RecoveryModeActiveControls } from "./recovery-mode-active-controls";
import { ChangePasswordForm } from "./change-password-form";
import {
  disconnectWhoopAction,
  mockConnectWhoopAction,
  mockDisconnectWhoopAction,
  signOutAction,
} from "./actions";

const WHOOP_ERROR_LABEL: Record<string, string> = {
  mock_mode: "WHOOP_MODE ainda é mock — configure as credenciais para conectar de verdade.",
  config: "Configuração da WHOOP incompleta (client_id/secret/redirect_uri).",
  invalid_state: "Sessão de autorização inválida ou expirada — tente novamente.",
  exchange_failed: "Não foi possível concluir a conexão com a WHOOP.",
};

const RECOVERY_TYPE_LABEL: Record<string, string> = {
  INJURED: "Lesionado",
  SICK: "Doente",
  GENERAL_RECOVERY: "Recuperação geral",
};

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

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ whoop_connected?: string; whoop_error?: string }>;
}) {
  const sessionUser = await requireUser();
  const { whoop_connected: whoopConnected, whoop_error: whoopError } = await searchParams;

  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: { profile: true, colorAssignment: true, whoopConnection: true },
  });

  const connectionStatus = user.whoopConnection?.status ?? "NOT_CONNECTED";
  const isConnected = connectionStatus !== "NOT_CONNECTED";
  const isLive = (process.env.WHOOP_MODE ?? "mock") === "live";

  const activeRecoveryMode = await getActiveRecoveryMode(user.id);
  const recoveryHistory = await getRecoveryModeHistory(user.id);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Perfil</h1>
      <header className="flex items-center gap-3">
        <span
          className="size-12 shrink-0 rounded-full border border-apex-border"
          style={{ backgroundColor: user.colorAssignment?.hex ?? "#242933" }}
          aria-hidden="true"
        />
        <div>
          <h2 className="text-lg font-semibold text-apex-text-primary">
            {user.profile?.displayName}
          </h2>
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
            {isLive
              ? "WHOOP_MODE=live — conexão real via OAuth."
              : "Modo mock ativo (WHOOP_MODE=mock) — nenhuma credencial real é usada ainda."}
          </p>

          {whoopConnected ? (
            <p className="text-xs text-apex-recovery-green">WHOOP conectada com sucesso.</p>
          ) : null}
          {whoopError ? (
            <p className="text-xs text-apex-recovery-red">
              {WHOOP_ERROR_LABEL[whoopError] ?? "Não foi possível conectar a WHOOP."}
            </p>
          ) : null}

          {isConnected ? (
            isLive ? (
              <form action={disconnectWhoopAction}>
                <SubmitButton variant="outline" pendingText="Desconectando…">
                  Desconectar
                </SubmitButton>
              </form>
            ) : (
              <form action={mockDisconnectWhoopAction}>
                <SubmitButton variant="outline" pendingText="Desconectando…">
                  Desconectar
                </SubmitButton>
              </form>
            )
          ) : isLive ? (
            <Button asChild variant="accent">
              <Link href="/api/whoop/oauth/start">Conectar WHOOP</Link>
            </Button>
          ) : (
            <form action={mockConnectWhoopAction}>
              <SubmitButton variant="accent" pendingText="Conectando…">
                Conectar WHOOP
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modo recuperação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {activeRecoveryMode ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-apex-text-primary">
                    {RECOVERY_TYPE_LABEL[activeRecoveryMode.type]}
                  </p>
                  <p className="text-xs text-apex-text-secondary">{activeRecoveryMode.reason}</p>
                </div>
                <Badge variant="recoveryYellow">
                  Até{" "}
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
                    activeRecoveryMode.endDate,
                  )}
                </Badge>
              </div>
              <RecoveryModeActiveControls recoveryModeId={activeRecoveryMode.id} />
            </>
          ) : (
            <>
              <p className="text-sm text-apex-text-secondary">
                Nenhum modo ativo. Ative se estiver lesionado, doente ou em recuperação geral —
                a engine ajusta a meta de Strain e a avaliação de consistência automaticamente.
              </p>
              <RecoveryModeForm />
            </>
          )}

          {recoveryHistory.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-apex-border pt-3">
              <p className="text-xs font-medium text-apex-text-tertiary">Histórico</p>
              {recoveryHistory.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-apex-text-secondary">
                    {RECOVERY_TYPE_LABEL[h.type]} ·{" "}
                    {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(h.startDate)}
                    –{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(h.endDate)}
                  </span>
                  <Badge variant={h.status === "ENDED" ? "default" : "recoveryYellow"}>
                    {h.status === "ENDED" ? "Encerrado" : h.status === "EXTENDED" ? "Estendido" : "Ativo"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <form action={signOutAction}>
        <SubmitButton variant="ghost" className="w-full text-apex-recovery-red" pendingText="Saindo…">
          Sair da conta
        </SubmitButton>
      </form>
    </div>
  );
}
