import { ChevronDown } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ConfidenceLevel } from "@/server/analysis/stats";
import type { Insight } from "@/server/analysis/types";

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  insufficient: "Dados insuficientes",
  exploratory: "Exploratório",
  low: "Confiança baixa",
  moderate: "Confiança moderada",
  good: "Confiança boa",
};

const CONFIDENCE_BADGE: Record<ConfidenceLevel, BadgeProps["variant"]> = {
  insufficient: "default",
  exploratory: "default",
  low: "default",
  moderate: "accent",
  good: "recoveryGreen",
};

/** Cartão de insight com "Por quê?" expansível — nunca caixa-preta (spec §"explicabilidade"). Usa `<details>` nativo, sem JS extra. */
export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-xl border border-apex-border bg-apex-surface-raised p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-apex-text-primary">{insight.title}</p>
        <Badge variant={CONFIDENCE_BADGE[insight.confidence]} className="shrink-0">
          {CONFIDENCE_LABEL[insight.confidence]}
        </Badge>
      </div>
      <p className="mt-1.5 text-sm text-apex-text-secondary">{insight.description}</p>
      <details className="group mt-2">
        <summary className="flex min-h-11 -mx-1 cursor-pointer select-none items-center gap-1 px-1 text-xs font-medium text-apex-accent">
          Por quê?
          <ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg bg-apex-surface p-3 text-xs">
          {insight.evidence.map((e) =>
            e.value ? (
              <div key={e.label} className="flex items-center justify-between gap-3">
                <span className="text-apex-text-tertiary">{e.label}</span>
                <span className="apex-numeric text-right text-apex-text-secondary">{e.value}</span>
              </div>
            ) : null,
          )}
          <div className="flex items-center justify-between gap-3 border-t border-apex-border pt-1.5">
            <span className="text-apex-text-tertiary">Tamanho da amostra</span>
            <span className="apex-numeric text-apex-text-secondary">{insight.sampleSize} dias</span>
          </div>
        </div>
      </details>
    </div>
  );
}
