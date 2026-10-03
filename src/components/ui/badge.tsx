import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * Badge — a small square-cornered label (never a pill). Text may wrap so long
 * Polish labels stay readable at 360 px. `accent` is the ROPS raspberry
 * outline, reserved for distinctions such as „Wybrana do upowszechniania".
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-sm leading-snug font-semibold no-underline transition-colors [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground [a]:hover:bg-[color-mix(in_srgb,var(--primary),var(--foreground)_20%)]",
        secondary:
          "border-hairline bg-surface text-foreground [a]:hover:border-input",
        destructive: "border-destructive bg-background text-destructive",
        outline:
          "border-input bg-background text-foreground [a]:hover:bg-surface",
        ghost: "border-transparent text-foreground hover:bg-accent",
        link: "text-primary border-transparent underline underline-offset-4",
        accent: "border-brand-accent bg-background text-brand-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
