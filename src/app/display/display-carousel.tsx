"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minus,
  Pause,
  Play,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { DisplayData } from "@/server/services/display.service";

const SCREEN_KEYS = [
  "grid_geral",
  "corrida_semana",
  "telemetria",
  "campeoes",
  "conquistas",
  "sem_piedade",
  "pit_wall",
] as const;

type ScreenKey = (typeof SCREEN_KEYS)[number];

const SCREEN_LABELS: Record<ScreenKey, string> = {
  grid_geral: "Grid Geral",
  corrida_semana: "Corrida da Semana",
  telemetria: "Telemetria",
  campeoes: "Campeões",
  conquistas: "Conquistas",
  sem_piedade: "Sem Piedade",
  pit_wall: "Pit Wall",
};

const DEFAULT_INTERVAL = 12;
const REFRESH_MS = 30_000;

function Avatar({ colorHex }: { colorHex: string | null }) {
  return (
    <span
      className="size-8 shrink-0 rounded-full border border-white/10"
      style={{ backgroundColor: colorHex ?? "#242933" }}
      aria-hidden="true"
    />
  );
}

function ScreenShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-10 py-12 md:px-20">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-apex-accent">{title}</p>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

function GridGeralScreen({ data }: { data: DisplayData["gridGeral"] }) {
  return (
    <ScreenShell title="Grid Geral">
      <div className="flex flex-col gap-3">
        {data.rows.map((row) => (
          <div
            key={row.userId}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4"
          >
            <span className="apex-numeric w-10 text-3xl font-bold text-apex-text-tertiary">
              {row.position}
            </span>
            <Avatar colorHex={row.colorHex} />
            <span className="flex-1 text-xl font-medium text-apex-text-primary">{row.nickname}</span>
            <span className="apex-numeric text-2xl font-semibold text-apex-text-primary">
              {row.points.toFixed(1)}
            </span>
            {row.trend > 0 ? (
              <ArrowUp className="size-6 text-apex-recovery-green" />
            ) : row.trend < 0 ? (
              <ArrowDown className="size-6 text-apex-recovery-red" />
            ) : (
              <Minus className="size-6 text-apex-text-tertiary" />
            )}
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

function CorridaDaSemanaScreen({ data }: { data: DisplayData["corridaDaSemana"] }) {
  return (
    <ScreenShell title="Corrida da Semana">
      <div className="flex flex-col gap-4">
        {data.athletes.map((athlete) => {
          const projected = data.projected?.find((p) => p.userId === athlete.userId);
          const last = data.days[data.days.length - 1]?.values.find((v) => v.userId === athlete.userId);
          return (
            <div key={athlete.userId} className="flex items-center gap-4">
              <Avatar colorHex={athlete.colorHex} />
              <span className="w-28 text-lg font-medium text-apex-text-primary">{athlete.nickname}</span>
              <div className="flex flex-1 gap-1">
                {data.days.map((day) => {
                  const v = day.values.find((x) => x.userId === athlete.userId);
                  const maxDaily = Math.max(1, ...day.values.map((x) => x.daily));
                  return (
                    <div
                      key={day.periodKey}
                      className="h-10 flex-1 rounded bg-white/5"
                      title={`${day.periodKey}: ${v?.daily.toFixed(1)}`}
                    >
                      <div
                        className="h-full rounded bg-apex-accent/70"
                        style={{ width: `${Math.min(100, ((v?.daily ?? 0) / maxDaily) * 100)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <span className="apex-numeric w-20 text-right text-xl font-semibold text-apex-text-primary">
                {last?.cumulative.toFixed(1) ?? "—"}
              </span>
              <span className="apex-numeric w-24 text-right text-xs text-apex-text-tertiary">
                proj. {projected?.projectedWeekTotal ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </ScreenShell>
  );
}

function TelemetriaScreen({ data }: { data: DisplayData["telemetria"] }) {
  return (
    <ScreenShell title="Telemetria">
      <div className="grid grid-cols-2 gap-4">
        {data.map((row) => (
          <div key={row.userId} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar colorHex={row.colorHex} />
              <span className="text-lg font-medium text-apex-text-primary">{row.nickname}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-apex-text-tertiary">Recovery</p>
                <p className="apex-numeric text-xl font-semibold text-apex-text-primary">
                  {row.recoveryScore != null ? Math.round(row.recoveryScore) : "—"}
                </p>
              </div>
              <div>
                <p className="text-apex-text-tertiary">Strain</p>
                <p className="apex-numeric text-xl font-semibold text-apex-text-primary">
                  {row.strain?.toFixed(1) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-apex-text-tertiary">Sono</p>
                <p className="apex-numeric text-xl font-semibold text-apex-text-primary">
                  {row.sleepPerformancePct != null ? `${Math.round(row.sleepPerformancePct)}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-apex-text-tertiary">HRV rel.</p>
                <p className="apex-numeric text-xl font-semibold text-apex-text-primary">
                  {row.hrvRelative != null ? `${row.hrvRelative}%` : "—"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

function CampeoesScreen({ data }: { data: DisplayData["campeoes"] }) {
  return (
    <ScreenShell title="Campeões">
      <div className="grid grid-cols-3 gap-4">
        {data.map((champ) => (
          <div key={champ.category} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-apex-text-tertiary">{champ.label}</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <Avatar colorHex={champ.colorHex} />
              <p className="text-lg font-medium text-apex-text-primary">{champ.nickname}</p>
              <p className="apex-numeric text-sm text-apex-text-tertiary">{champ.avg ?? "—"} pts</p>
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

function ConquistasScreen({ data }: { data: DisplayData["conquistas"] }) {
  return (
    <ScreenShell title="Conquistas">
      <div className="grid grid-cols-4 gap-4">
        {data.map((a, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <span className="text-4xl" aria-hidden="true">
              {a.icon}
            </span>
            <p className="text-sm font-medium text-apex-text-primary">{a.name}</p>
            <div className="flex items-center gap-1.5">
              <Avatar colorHex={a.colorHex} />
              <span className="text-xs text-apex-text-tertiary">{a.nickname}</span>
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

function SemPiedadeScreen({ data }: { data: DisplayData["semPiedade"] }) {
  return (
    <ScreenShell title="Sem Piedade">
      <div className="flex flex-col gap-4">
        {data.lastPlace ? (
          <div className="rounded-2xl border border-apex-recovery-red/30 bg-apex-recovery-red/5 p-5">
            <p className="text-xs uppercase tracking-wide text-apex-recovery-red">Último lugar</p>
            <p className="mt-1 text-xl font-medium text-apex-text-primary">{data.lastPlace.nickname}</p>
          </div>
        ) : null}
        {data.biggestDrop ? (
          <div className="rounded-2xl border border-apex-recovery-yellow/30 bg-apex-recovery-yellow/5 p-5">
            <p className="text-xs uppercase tracking-wide text-apex-recovery-yellow">Maior queda</p>
            <p className="mt-1 text-xl font-medium text-apex-text-primary">
              {data.biggestDrop.nickname} · {Math.abs(data.biggestDrop.trend)} posições
            </p>
          </div>
        ) : null}
        {data.roasts
          .filter((r) => r.roastText)
          .map((r) => (
            <div key={r.userId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
              <Avatar colorHex={r.colorHex} />
              <p className="text-base text-apex-text-primary">
                <span className="font-medium">{r.nickname}:</span> {r.roastText}
              </p>
            </div>
          ))}
      </div>
    </ScreenShell>
  );
}

function PitWallScreen({ data }: { data: DisplayData["pitWall"] }) {
  return (
    <ScreenShell title="Pit Wall">
      <div className="flex flex-col gap-3">
        {data.map((row) => (
          <div key={row.userId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5">
            <Avatar colorHex={row.colorHex} />
            <span className="w-24 text-base font-medium text-apex-text-primary">{row.nickname}</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {row.shouldRest ? (
                <span className="rounded-full bg-apex-recovery-red/15 px-3 py-1 text-xs text-apex-recovery-red">
                  Deve descansar
                </span>
              ) : null}
              {row.shouldTrain ? (
                <span className="rounded-full bg-apex-recovery-green/15 px-3 py-1 text-xs text-apex-recovery-green">
                  Livre para treinar
                </span>
              ) : null}
              {row.overStrain ? (
                <span className="rounded-full bg-apex-recovery-yellow/15 px-3 py-1 text-xs text-apex-recovery-yellow">
                  Acima do Strain
                </span>
              ) : null}
              {row.journalPending ? (
                <span className="rounded-full bg-apex-accent/15 px-3 py-1 text-xs text-apex-accent">
                  Journal pendente
                </span>
              ) : null}
              {row.noData ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-apex-text-secondary">
                  Sem dados
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

export function DisplayCarousel({ initialData }: { initialData: DisplayData }) {
  const [data, setData] = useState<DisplayData>(initialData);
  const [screenIndex, setScreenIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [intervalSeconds] = useState(DEFAULT_INTERVAL);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const screens = useMemo(
    () =>
      SCREEN_KEYS.map((key) => ({
        key,
        label: SCREEN_LABELS[key],
      })),
    [],
  );

  const goNext = useCallback(() => {
    setScreenIndex((i) => (i + 1) % screens.length);
  }, [screens.length]);

  const goPrev = useCallback(() => {
    setScreenIndex((i) => (i - 1 + screens.length) % screens.length);
  }, [screens.length]);

  // Auto-avanço
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(goNext, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [paused, intervalSeconds, goNext]);

  // Atualização de dados sem recarregar a página
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/display/data");
        if (res.ok) setData(await res.json());
      } catch {
        // erro temporário de rede — mantém os dados atuais na tela
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Auto-hide dos controles
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }, []);

  useEffect(() => {
    // controlsVisible já começa true (useState) — o efeito só agenda o auto-hide inicial,
    // sem chamar setState de forma síncrona no corpo do efeito.
    hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      showControls();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === " ") setPaused((p) => !p);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, showControls]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  const currentKey = screens[screenIndex].key;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-apex-bg"
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="h-full w-full"
        >
          {currentKey === "grid_geral" ? <GridGeralScreen data={data.gridGeral} /> : null}
          {currentKey === "corrida_semana" ? <CorridaDaSemanaScreen data={data.corridaDaSemana} /> : null}
          {currentKey === "telemetria" ? <TelemetriaScreen data={data.telemetria} /> : null}
          {currentKey === "campeoes" ? <CampeoesScreen data={data.campeoes} /> : null}
          {currentKey === "conquistas" ? <ConquistasScreen data={data.conquistas} /> : null}
          {currentKey === "sem_piedade" ? <SemPiedadeScreen data={data.semPiedade} /> : null}
          {currentKey === "pit_wall" ? <PitWallScreen data={data.pitWall} /> : null}
        </motion.div>
      </AnimatePresence>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent px-8 py-6 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex gap-1.5">
          {screens.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScreenIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === screenIndex ? "w-8 bg-apex-accent" : "w-4 bg-white/20",
              )}
              aria-label={s.label}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label="Tela anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label={paused ? "Retomar" : "Pausar"}
          >
            {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label="Próxima tela"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label="Tela cheia"
          >
            <Maximize className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
