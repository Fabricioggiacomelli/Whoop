import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent focus-visible:ring-offset-2 focus-visible:ring-offset-apex-bg disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-apex-text-primary text-apex-bg hover:bg-apex-text-primary/90",
        accent:
          "bg-gradient-to-br from-apex-accent to-apex-accent-2 text-white shadow-[0_4px_20px_-6px_var(--apex-accent)] hover:brightness-110",
        outline:
          "border border-apex-border bg-transparent text-apex-text-primary hover:bg-apex-surface-raised hover:border-apex-border-strong",
        ghost: "text-apex-text-secondary hover:bg-apex-surface hover:text-apex-text-primary",
        destructive: "bg-apex-recovery-red text-white hover:bg-apex-recovery-red/90",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-13 px-7 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
