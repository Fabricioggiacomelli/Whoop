"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/** Mini-gráfico de tendência — só a forma da curva, sem eixos/legendas (glanceável, não analítico). O gráfico interativo completo já existe em Evolução, reaproveitado mais abaixo na página. */
export function Sparkline({
  data,
  color = "#4D7BFF",
}: {
  data: Array<{ value: number | null }>;
  color?: string;
}) {
  const hasData = data.some((d) => d.value != null);
  if (!hasData) {
    return <div className="flex h-10 items-center text-xs text-apex-text-tertiary">Sem dados</div>;
  }

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
