"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

import type { EvolutionPoint } from "@/server/services/evolution.service";

const METRICS = [
  { key: "score", label: "Pontuação", unit: "" },
  { key: "recovery", label: "Recovery", unit: "" },
  { key: "hrvRelative", label: "HRV relativo", unit: "%" },
  { key: "restingHr", label: "FC repouso", unit: " bpm" },
  { key: "sleep", label: "Sono", unit: "%" },
  { key: "strain", label: "Strain", unit: "" },
  { key: "consistency", label: "Consistência", unit: "" },
  { key: "habits", label: "Hábitos", unit: "" },
  { key: "position", label: "Posição", unit: "º" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const ACCENT = "#4D7BFF";

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-surface-raised px-3 py-2 text-xs shadow-lg">
      <p className="text-apex-text-tertiary">{label}</p>
      <p className="apex-numeric font-medium text-apex-text-primary">
        {payload[0].value}
        {unit}
      </p>
    </div>
  );
}

export function EvolutionChart({ points }: { points: EvolutionPoint[] }) {
  const [metric, setMetric] = useState<MetricKey>("score");
  const config = METRICS.find((m) => m.key === metric)!;

  const data = useMemo(
    () =>
      points.map((p) => ({
        date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
          new Date(`${p.date.length === 7 ? p.date + "-01" : p.date}T12:00:00`),
        ),
        value: p[metric] === null || p[metric] === undefined ? null : Number(p[metric]),
      })),
    [points, metric],
  );

  const hasData = data.some((d) => d.value !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              metric === m.key
                ? "border-apex-accent bg-apex-accent/10 text-apex-text-primary"
                : "border-apex-border text-apex-text-secondary hover:text-apex-text-primary",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {hasData ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#242933" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#565c68", fontSize: 11 }}
                axisLine={{ stroke: "#242933" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#565c68", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={metric === "position" ? [1, "dataMax"] : ["auto", "auto"]}
                reversed={metric === "position"}
              />
              <Tooltip
                content={<CustomTooltip unit={config.unit} />}
                cursor={{ stroke: "#242933", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: ACCENT }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-apex-text-secondary">Sem dados para esta métrica no período.</p>
      )}
    </div>
  );
}
