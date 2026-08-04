import Link from "next/link";

import { cn } from "@/lib/utils";

const SCOPES = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "geral", label: "Geral" },
] as const;

export function ScopeTabs({ current }: { current: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-apex-border bg-apex-surface p-1">
      {SCOPES.map((scope) => (
        <Link
          key={scope.value}
          href={`/ranking?scope=${scope.value}`}
          className={cn(
            "flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150",
            current === scope.value
              ? "bg-apex-surface-raised text-apex-text-primary"
              : "text-apex-text-secondary hover:text-apex-text-primary",
          )}
        >
          {scope.label}
        </Link>
      ))}
    </div>
  );
}
