import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Evolução" };

export default function EvolucaoPage() {
  return (
    <ComingSoon
      title="Evolução"
      description="Gráficos de 7/14/30/90 dias e desde o início (pontuação, Recovery, HRV relativo, sono, Strain, posição) chegam na Fase 2, com Recharts sobre os dados simulados do seed."
    />
  );
}
