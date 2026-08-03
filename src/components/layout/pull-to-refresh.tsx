"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Gesto "puxar para atualizar" — o navegador não oferece isso sozinho quando o PWA roda em
 * modo standalone (sem chrome do navegador), diferente de abrir o site numa aba normal.
 * Dispara uma sincronização real com a WHOOP (não só um re-render do que já está salvo),
 * já que o objetivo é ver dados atualizados na hora, não esperar o cron do dia seguinte.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0]?.clientY ?? null;
    pulling.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current || startY.current == null) return;
    const delta = (e.touches[0]?.clientY ?? 0) - startY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Resistência progressiv — puxar fica mais "pesado" quanto mais estica.
    setPullDistance(Math.min(MAX_PULL, delta * 0.5));
  }

  async function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      try {
        await fetch("/api/whoop/sync-now", { method: "POST" });
      } catch {
        // Puxar-para-atualizar não deve travar a UI se a sincronização falhar.
      }
      router.refresh();
      setTimeout(() => setRefreshing(false), 400);
    }
    setPullDistance(0);
  }

  const indicatorHeight = refreshing ? 56 : pullDistance;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden text-xs font-medium text-apex-text-tertiary transition-[height] duration-200"
        style={{ height: indicatorHeight }}
        aria-hidden={indicatorHeight === 0}
      >
        {refreshing ? (
          <span className="inline-flex items-center gap-2">
            <span className="size-3.5 animate-spin rounded-full border-2 border-apex-text-tertiary border-t-transparent" />
            Atualizando…
          </span>
        ) : pullDistance >= PULL_THRESHOLD ? (
          "Solte para atualizar"
        ) : pullDistance > 0 ? (
          "Puxe para atualizar"
        ) : null}
      </div>
      {children}
    </div>
  );
}
