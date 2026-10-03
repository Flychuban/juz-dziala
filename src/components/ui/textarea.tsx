import * as React from "react";
import { cn } from "cn";

/** Multi-line input: the same 2 px input border as <Input>; grows with content. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive flex field-sizing-content min-h-32 w-full rounded-md border-2 px-3.5 py-3 text-base leading-relaxed transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
