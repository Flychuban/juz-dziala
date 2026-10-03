import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * Alert — a hairline panel with a 4 px leading rule that carries the tone.
 * The tone is never colour alone: give every alert a title in words.
 * Default `role="alert"` is kept for API compatibility; pass `role="note"`
 * (or `role={undefined}`) for static, non-urgent notices.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-md border border-l-4 px-4 py-3 text-left text-base has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-28 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "border-hairline border-l-primary bg-surface text-foreground",
        destructive:
          "border-hairline border-l-destructive bg-background text-foreground *:[svg]:text-destructive",
        warning:
          "border-hairline border-l-foreground bg-warning-bg text-foreground",
        success:
          "border-hairline border-l-success bg-background text-foreground *:[svg]:text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "default"}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-display group-data-[variant=destructive]/alert:text-destructive leading-snug font-bold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-foreground text-base text-pretty group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4 [&_p:not(:last-child)]:mb-3",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
