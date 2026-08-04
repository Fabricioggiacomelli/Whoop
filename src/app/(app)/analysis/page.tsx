import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";

import { requireUser } from "@/server/services/auth-guard";
import { getAnalysisViewModel, type CurrentStateItem, type MetricComparison } from "@/server/analysis/analysis.service";
import { getDailyMetricsSeries } from "@/server/analysis/metrics";
import { generateHabitInsights } from "@/server/analysis/insights";
import { currentAndPreviousRange, resolveAnalysisPeriod, ANALYSIS_PERIODS } from "@/server/analysis/timeframes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { InsightCard } from "./insight-card";
import { Sparkline } from "./sparkline";

export const metadata: Metadata = { title: "Análise" };

function describeZScore(z: number | null, higherIsBetter: boolean): { text: string; tone: "good" | "neutral" | "watch" } {
  if (z == null) return { text: "sem baseline suficiente ainda", tone: "neutral" };
  const effective = higherIsBetter ? z : -z;
  const magnitude = Math.abs(z);
  if (magnitude < 0.5) return { text: "dentro do seu padrão habitual", tone: "neutral" };
  const direction = z > 0 ? "acima" : "abaixo";
  const intensity = magnitude >= 1.5 ? "bem " : "levemente ";
  const tone: "good" | "watch" = effective > 0 ? "good" : "watch";
  return { text: `${intensity}${direction} do seu habitual`, tone };
}

function ToneDot({ tone }: { tone: "good" | "neutral" | "watch" }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 rounded-full",
        tone === "good" && "bg-apex-recovery-green",
        tone === "watch" && "bg-apex-recovery-yellow",
        tone === "neutral" && "bg-apex-text-tertiary",
      )}
      aria-hidden="true"
    />
  );
}

function CurrentStateRow({ item }: { item: CurrentStateItem }) {
  const higherIsBetter = item.key !== "restingHeartRate";
  const { text, tone } = describeZScore(item.zScore, higherIsBetter);
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2">
        <ToneDot tone={tone} />
        <span className="text-sm text-apex-text-secondary">{item.label}</span>
      </div>
      <div className="text-right">
        <span className="apex-numeric text-sm font-medium text-apex-text-primary">
          {item.value != null ? `${Math.round(item.value * 10) / 10}${item.unit}` : "—"}
        </span>
        <p className="text-xs text-apex-text-tertiary">{text}</p>
      </div>
    </div>
  );
}

function ComparisonTile({ comparison }: { comparison: MetricComparison }) {
  const delta = comparison.percentChange;
  const isUp = delta != null && delta > 1;
  const isDown = delta != null && delta < -1;
  const good = (isUp && comparison.higherIsBetter) || (isDown && !comparison.higherIsBetter);
  const bad = (isUp && !comparison.higherIsBetter) || (isDown && comparison.higherIsBetter);

  return (
    <div className="rounded-lg border border-apex-border bg-apex-surface-raised p-3">
      <p className="text-xs text-apex-text-tertiary">{comparison.label}</p>
      <p className="apex-numeric mt-1 text-lg font-semibold text-apex-text-primary">
        {comparison.current != null ? Math.round(comparison.current * 10) / 10 : "—"}
        <span className="ml-1 text-xs font-normal text-apex-text-tertiary">{comparison.unit}</span>
      </p>
      {delta != null ? (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            good && "text-apex-recovery-green",
            bad && "text-apex-recovery-red",
            !good && !bad && "text-apex-text-tertiary",
          )}
        >
          {isUp ? <ArrowUp className="size-3" /> : isDown ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
          {Math.abs(Math.round(delta))}% vs. período anterior
        </p>
      ) : (
        <p className="mt-1 text-xs text-apex-text-tertiary">Sem comparação disponível</p>
      )}
    </div>
  );
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const { period: periodParam } = await searchParams;
  const period = resolveAnalysisPeriod(periodParam);

  const [viewModel, habitSeriesRaw] = await Promise.all([
    getAnalysisViewModel(user.id, periodParam),
    (async () => {
      const { current } = currentAndPreviousRange(period.days);
      return getDailyMetricsSeries(user.id, current.from, current.to);
    })(),
  ]);

  const habitInsights = generateHabitInsights(habitSeriesRaw);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-apex-text-primary">Análise</h1>

      <div className="flex gap-2 overflow-x-auto">
        {ANALYSIS_PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/analysis?period=${p.key}`}
            className={cn(
              "flex min-h-11 shrink-0 items-center rounded-lg border px-3.5 text-xs font-medium transition-colors duration-150",
              period.key === p.key
                ? "border-apex-accent bg-apex-accent/10 text-apex-text-primary"
                : "border-apex-border text-apex-text-secondary",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-apex-border bg-apex-surface-raised px-3 py-2.5 text-xs text-apex-text-tertiary">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          Estatísticas pessoais baseadas só nos seus próprios dados — não é orientação médica,
          diagnóstico ou recomendação clínica. Pra decisões sobre treino, sono ou saúde, converse
          com um profissional.
        </p>
      </div>

      {!viewModel.hasEnoughData ? (
        <Card className="p-5 text-sm text-apex-text-secondary">
          Ainda não há dias suficientes fechados neste período (
          {viewModel.totalDaysWithData} de pelo menos 5 necessários) pra gerar análises
          confiáveis. Continue sincronizando a WHOOP e respondendo o Journal.
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Seu estado atual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-apex-border pt-0">
          {viewModel.currentState.map((item) => (
            <CurrentStateRow key={item.key} item={item} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparação com o período anterior</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0">
          {viewModel.comparisons.map((c) => (
            <ComparisonTile key={c.key} comparison={c} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tendências do período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          {(
            [
              { key: "recoveryScore", label: "Recovery", color: "#3DDC84" },
              { key: "hrvMs", label: "HRV", color: "#22D3EE" },
              { key: "restingHeartRate", label: "FC de repouso", color: "#FF5C5C" },
              { key: "sleepPerformancePct", label: "Sleep Performance", color: "#4D7BFF" },
            ] as const
          ).map((m) => (
            <div key={m.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-apex-text-secondary">{m.label}</span>
              <div className="flex-1">
                <Sparkline
                  data={viewModel.trendSeries.map((d) => ({ value: d[m.key] }))}
                  color={m.color}
                />
              </div>
            </div>
          ))}
          <Link href="/analysis/evolucao" className="mt-1 text-xs font-medium text-apex-accent">
            Ver gráfico detalhado e comparar outras métricas →
          </Link>
        </CardContent>
      </Card>

      {viewModel.topInsights.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-apex-text-primary">Principais insights</h2>
          {viewModel.topInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : null}

      {viewModel.topOpportunities.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-apex-text-primary">Oportunidades</h2>
          {viewModel.topOpportunities.map((insight) => (
            <InsightCard key={`opp-${insight.id}`} insight={insight} />
          ))}
        </div>
      ) : null}

      {viewModel.topPositives.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-apex-text-primary">O que está funcionando</h2>
          {viewModel.topPositives.map((insight) => (
            <InsightCard key={`pos-${insight.id}`} insight={insight} />
          ))}
        </div>
      ) : null}

      {habitInsights.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-apex-text-primary">Impacto dos hábitos</h2>
          {habitInsights.map((insight) => (
            <InsightCard key={`habit-${insight.id}`} insight={insight} />
          ))}
        </div>
      ) : (
        <Card className="p-5 text-sm text-apex-text-secondary">
          Ainda não há hábitos suficientes registrados neste período pra calcular impacto —
          responda o Journal com mais regularidade pra desbloquear esta seção.
        </Card>
      )}
    </div>
  );
}
