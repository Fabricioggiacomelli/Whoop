import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-apex-border bg-apex-surface-raised text-apex-text-secondary",
        recoveryGreen: "border-transparent bg-apex-recovery-green/15 text-apex-recovery-green",
        recoveryYellow: "border-transparent bg-apex-recovery-yellow/15 text-apex-recovery-yellow",
        recoveryRed: "border-transparent bg-apex-recovery-red/15 text-apex-recovery-red",
        accent: "border-transparent bg-apex-accent/15 text-apex-accent",
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
