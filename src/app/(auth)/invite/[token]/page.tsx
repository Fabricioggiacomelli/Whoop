import Link from "next/link";
import type { Metadata } from "next";

import { getRedeemableInvite } from "@/server/services/invite.service";
import { Button } from "@/components/ui/button";

import { RedeemForm } from "./redeem-form";

export const metadata: Metadata = {
  title: "Convite",
};

const REASON_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Este link de convite não existe.",
  REVOKED: "Este convite foi revogado pelo administrador.",
  ALREADY_USED: "Este convite já foi usado.",
  EXPIRED: "Este convite expirou. Peça um novo ao administrador.",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { invite, reason } = await getRedeemableInvite(token);

  if (!invite) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full max-w-sm">
          <h1 className="text-lg font-semibold text-apex-text-primary">Convite indisponível</h1>
          <p className="mt-3 text-sm text-apex-text-secondary">
            {reason ? REASON_MESSAGES[reason] : "Este convite não pode ser usado."}
          </p>
          <Button asChild variant="outline" size="lg" className="mt-8 w-full">
            <Link href="/login">Voltar para o login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold tracking-tight text-apex-text-primary">
            APEX<span className="text-apex-accent">4</span>
          </span>
          <p className="mt-2 text-sm text-apex-text-secondary">Você foi convidado. Bem-vindo(a).</p>
        </div>

        <RedeemForm token={token} email={invite.email} />
      </div>
    </div>
  );
}
