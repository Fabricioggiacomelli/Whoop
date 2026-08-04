"use client";

import { animate } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";

const SIZE = 112;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Conta de 0 até `target` — o placar "aparece rodando", em vez de simplesmente aparecer. */
function useCountUp(target: number) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, target, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [target]);

  return display;
}

/**
 * Anel de progresso = o quão perto do líder você está hoje (progress=1 quando você É o
 * líder). Não é decoração — é a mesma informação do "-X do 1º" abaixo, só que legível de
 * relance, no estilo telemetria/HUD que o brief original pedia.
 */
export function ScoreRing({
  progress,
  points,
  href,
}: {
  progress: number;
  points: number;
  href: string;
}) {
  const displayPoints = useCountUp(points);
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <Link
      href={href}
      className="relative inline-flex shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent focus-visible:ring-offset-2 focus-visible:ring-offset-apex-surface"
      aria-label={`Ver detalhe da pontuação — ${points.toFixed(1)} pontos`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--apex-border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#apexScoreRingGradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
        <defs>
          <linearGradient id="apexScoreRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--apex-accent)" />
            <stop offset="100%" stopColor="var(--apex-accent-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="apex-numeric text-2xl font-bold text-apex-text-primary">
          {displayPoints.toFixed(1)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-apex-text-tertiary">
          pontos
        </span>
      </div>
    </Link>
  );
}
