import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-20 w-full rounded-lg border border-apex-border bg-apex-surface-raised px-3.5 py-2.5 text-[15px] text-apex-text-primary placeholder:text-apex-text-tertiary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
