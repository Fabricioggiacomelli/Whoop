import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriasPage() {
  return (
    <ComingSoon
      title="Categorias"
      description="Os campeões de cada categoria (sono, Recovery, evolução, consistência, hábitos...) chegam na Fase 2, quando a engine de pontuação estiver rodando sobre os dados simulados."
    />
  );
}
