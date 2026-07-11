import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "focus-ring-none flex h-12 w-full rounded-2xl border border-input bg-muted/50 px-4 py-2 text-base text-foreground placeholder:text-muted-foreground/70",
          "focus-visible:outline-none focus-visible:border-sage focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:bg-card",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-300 ease-out",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
