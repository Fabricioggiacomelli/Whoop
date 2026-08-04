"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { submitJournalAction } from "./actions";
import { HABIT_OPTIONS } from "./habit-options";
import { JOURNAL_QUESTIONS } from "./journal-questions";
import type { HabitResponseType } from "@/generated/prisma/enums";

type HabitCard = { id: string; key: string; label: string; responseType: HabitResponseType };

export function JournalFlow({ habits }: { habits: HabitCard[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConfirming = step === habits.length;
  const current = habits[step];

  function selectAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setStep((s) => Math.min(s + 1, habits.length));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitJournalAction(answers);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-label={`Progresso do journal — pergunta ${Math.min(step + 1, habits.length)} de ${habits.length}`}
        aria-valuemin={0}
        aria-valuemax={habits.length}
        aria-valuenow={isConfirming ? habits.length : step}
      >
        {habits.map((h, i) => (
          <div
            key={h.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < step || isConfirming ? "bg-apex-accent" : "bg-apex-border",
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!isConfirming ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
              {step + 1} de {habits.length}
            </p>
            <h2 className="text-xl font-semibold text-apex-text-primary">
              {JOURNAL_QUESTIONS[current.key] ?? current.label}
            </h2>

            <div className="flex flex-col gap-2">
              {HABIT_OPTIONS[current.responseType].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectAnswer(current.key, option.value)}
                  className={cn(
                    "rounded-xl border border-apex-border bg-apex-surface px-4 py-3.5 text-left text-sm font-medium text-apex-text-primary transition-colors hover:border-apex-accent/50 hover:bg-apex-surface-raised",
                    answers[current.key] === option.value && "border-apex-accent bg-apex-accent/10",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {step > 0 ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="size-4" /> Voltar
              </Button>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <h2 className="text-xl font-semibold text-apex-text-primary">Confirme suas respostas</h2>

            <div className="flex flex-col gap-2">
              {habits.map((h, i) => {
                const option = HABIT_OPTIONS[h.responseType].find((o) => o.value === answers[h.key]);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setStep(i)}
                    className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-surface px-3.5 py-2.5 text-left text-sm"
                  >
                    <span className="text-apex-text-secondary">{h.label}</span>
                    <span className="font-medium text-apex-text-primary">{option?.label}</span>
                  </button>
                );
              })}
            </div>

            {error ? <p className="text-sm text-apex-recovery-red">{error}</p> : null}

            <Button variant="accent" size="lg" disabled={isPending} onClick={submit}>
              <Check className="size-4" /> {isPending ? "Enviando…" : "Enviar Journal"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStep(habits.length - 1)}>
              <ChevronLeft className="size-4" /> Voltar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
