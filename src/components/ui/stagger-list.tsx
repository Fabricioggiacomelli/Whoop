"use client";

import { motion } from "framer-motion";

/** Entrada em cascata pra listas curtas (ranking, conquistas) — cada item aparece ~40ms
 * depois do anterior. `prefers-reduced-motion` já é tratado globalmente (transition-duration
 * zerada via CSS), então não precisa de lógica extra aqui. */
export function StaggerList({
  children,
  className,
}: {
  children: React.ReactNode[];
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04, ease: "easeOut" }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
