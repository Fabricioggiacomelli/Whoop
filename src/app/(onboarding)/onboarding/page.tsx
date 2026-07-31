import type { Metadata } from "next";

import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth-guard";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Complete seu perfil",
};

export default async function OnboardingPage() {
  const user = await requireUser();
  const takenColors = await db.userColor.findMany({
    where: { userId: { not: user.id } },
    select: { hex: true },
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col px-6 py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
          Passo 1 de 2
        </p>
        <h1 className="mt-1 text-xl font-semibold text-apex-text-primary">Complete seu perfil</h1>
        <p className="mt-2 text-sm text-apex-text-secondary">
          Isso ajuda a personalizar sua experiência e evita conflito de cores no ranking.
        </p>
      </header>

      <OnboardingForm takenColors={takenColors.map((c) => c.hex)} />
    </div>
  );
}
