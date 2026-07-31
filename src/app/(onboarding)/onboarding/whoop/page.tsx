import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

import { mockConnectWhoopAction } from "../actions";

export const metadata: Metadata = {
  title: "Conectar WHOOP",
};

export default function OnboardingWhoopPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
        Passo 2 de 2
      </p>
      <h1 className="mt-1 text-xl font-semibold text-apex-text-primary">Conecte sua WHOOP</h1>
      <p className="mt-2 text-sm text-apex-text-secondary">
        O APEX 4 calcula tudo a partir dos seus dados fisiológicos. Sem conectar, você não
        pontua — pode fazer isso agora ou depois, pelo Perfil.
      </p>

      <form action={mockConnectWhoopAction} className="mt-8 flex flex-col gap-3">
        <Button type="submit" variant="accent" size="lg">
          Conectar WHOOP
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/home">Pular por agora</Link>
        </Button>
      </form>
    </div>
  );
}
