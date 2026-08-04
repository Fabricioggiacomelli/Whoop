import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-apex-border bg-apex-surface-raised text-apex-text-secondary",
        recoveryGreen:
          "border-apex-recovery-green/25 bg-apex-recovery-green/15 text-apex-recovery-green shadow-[0_0_16px_-6px_var(--apex-recovery-green)]",
        recoveryYellow:
          "border-apex-recovery-yellow/25 bg-apex-recovery-yellow/15 text-apex-recovery-yellow shadow-[0_0_16px_-6px_var(--apex-recovery-yellow)]",
        recoveryRed:
          "border-apex-recovery-red/25 bg-apex-recovery-red/15 text-apex-recovery-red shadow-[0_0_16px_-6px_var(--apex-recovery-red)]",
        accent:
          "border-apex-accent/25 bg-apex-accent/15 text-apex-accent shadow-[0_0_16px_-6px_var(--apex-accent)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
