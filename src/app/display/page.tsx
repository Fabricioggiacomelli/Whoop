import type { Metadata } from "next";

export const metadata: Metadata = { title: "Telão" };

export default function DisplayPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <span className="text-3xl font-semibold tracking-tight text-apex-text-primary">
        APEX<span className="text-apex-accent">4</span>
      </span>
      <p className="max-w-sm text-sm text-apex-text-secondary">
        O carrossel do modo telão (Grid Geral, Corrida da Semana, Telemetria, Campeões,
        Conquistas, Sem Piedade, Pit Wall) chega na Fase 2, junto com o ranking e a engine de
        pontuação. Ver ARCHITECTURE.md §7.
      </p>
    </div>
  );
}
