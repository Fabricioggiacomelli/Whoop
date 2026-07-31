import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Metas" };

export default function MetasPage() {
  return (
    <ComingSoon
      title="Metas"
      description="Criação, sugestão automática, aprovação e acompanhamento de metas (ciclo de 14 dias) chegam na Fase 2. O schema (Goal, GoalSuggestion, GoalProgress) já está pronto."
    />
  );
}
