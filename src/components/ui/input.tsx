import * as React from "react";
import { cn } from "cn";

/**
 * Text input: 2 px border in the input colour (#6B7A90, 4.5:1 on white),
 * 48 px tall, 18 px text. Always pair it with a visible <Label>.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive file:bg-surface min-h-12 w-full min-w-0 rounded-md border-2 px-3.5 py-2 text-base transition-colors file:mr-3 file:inline-flex file:min-h-9 file:rounded file:border-0 file:px-3 file:text-sm file:font-semibold disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
