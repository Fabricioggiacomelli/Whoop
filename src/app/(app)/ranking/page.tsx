import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Ranking" };

export default function RankingPage() {
  return (
    <ComingSoon
      title="Ranking"
      description="Rankings diário, semanal, mensal e geral chegam na Fase 2, junto com a engine de pontuação sobre dados simulados. O schema (RankingSnapshot) já está pronto no banco."
    />
  );
}
