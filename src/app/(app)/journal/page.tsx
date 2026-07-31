import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage() {
  return (
    <ComingSoon
      title="Journal"
      description="O fluxo de cartões do Journal matinal (água, alimentação, álcool, sauna, mobilidade, fisioterapia, meditação, cafeína) chega na Fase 2. O catálogo de hábitos já está no banco."
    />
  );
}
