import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/server/services/auth-guard";
import { getEvolutionSeries } from "@/server/services/evolution.service";
import { cn } from "@/lib/utils";

import { EvolutionChart } from "./evolution-chart";

export const metadata: Metadata = { title: "Evolução detalhada" };

const WINDOWS = [
  { value: "7", label: "7d", days: 7 },
  { value: "14", label: "14d", days: 14 },
  { value: "30", label: "30d", days: 30 },
  { value: "90", label: "90d", days: 90 },
  { value: "all", label: "Desde o início", days: null },
] as const;

export default async function AnalysisEvolucaoPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const user = await requireUser();
  const { window: windowParam } = await searchParams;
  const selected = WINDOWS.find((w) => w.value === windowParam) ?? WINDOWS[2];

  const points = await getEvolutionSeries(user.id, selected.days);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/analysis" className="flex items-center gap-1 text-sm text-apex-text-secondary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Análise
      </Link>
      <h1 className="text-xl font-semibold text-apex-text-primary">Evolução detalhada</h1>

      <div className="flex gap-2 overflow-x-auto">
        {WINDOWS.map((w) => (
          <Link
            key={w.value}
            href={`/analysis/evolucao?window=${w.value}`}
            className={cn(
              "flex min-h-11 shrink-0 items-center rounded-lg border px-3.5 text-xs font-medium transition-colors duration-150",
              selected.value === w.value
                ? "border-apex-accent bg-apex-accent/10 text-apex-text-primary"
                : "border-apex-border text-apex-text-secondary",
            )}
          >
            {w.label}
          </Link>
        ))}
      </div>

      <EvolutionChart points={points} />
    </div>
  );
}
