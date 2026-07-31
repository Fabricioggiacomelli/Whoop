import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-lg border border-apex-border bg-apex-surface-raised px-3.5 text-[15px] text-apex-text-primary placeholder:text-apex-text-tertiary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
