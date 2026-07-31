import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/server/services/auth-guard";
import { getEvolutionSeries } from "@/server/services/evolution.service";
import { cn } from "@/lib/utils";

import { EvolutionChart } from "./evolution-chart";

export const metadata: Metadata = { title: "Evolução" };

const WINDOWS = [
  { value: "7", label: "7d", days: 7 },
  { value: "14", label: "14d", days: 14 },
  { value: "30", label: "30d", days: 30 },
  { value: "90", label: "90d", days: 90 },
  { value: "all", label: "Desde o início", days: null },
] as const;

export default async function EvolucaoPage({
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
      <h1 className="text-xl font-semibold text-apex-text-primary">Evolução</h1>

      <div className="flex gap-1.5 overflow-x-auto">
        {WINDOWS.map((w) => (
          <Link
            key={w.value}
            href={`/evolucao?window=${w.value}`}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
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
