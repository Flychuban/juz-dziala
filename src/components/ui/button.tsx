import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * Button — „premium civic". Primary is solid ROPS blue; secondary is a thin
 * blue outline. Every size is a ≥ 44 px target (default 48 px). Labels may
 * wrap: at 360 px with enlarged text a label must never overflow its button.
 * Never wider than its container (max-w-full), so long labels wrap at
 * 320 px instead of scrolling the page (WCAG 1.4.10).
 * Use `asChild` with <Link> for navigation. Focus styling is global
 * (globals.css) and is deliberately not overridden here.
 */
const buttonVariants = cva(
  "group/button inline-flex max-w-full shrink-0 items-center justify-center rounded-md border border-transparent text-center leading-tight font-semibold no-underline transition-colors select-none disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary),var(--foreground)_20%)] aria-expanded:bg-[color-mix(in_srgb,var(--primary),var(--foreground)_20%)]",
        secondary:
          "border-primary bg-background text-primary hover:bg-accent aria-expanded:bg-accent",
        outline:
          "border-input bg-background text-foreground hover:bg-surface aria-expanded:bg-surface",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "border-destructive bg-background text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_10%,var(--background))]",
        link: "text-primary underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        default:
          "min-h-12 gap-2 px-5 py-2 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "min-h-11 gap-1.5 px-3 py-1.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        sm: "min-h-11 gap-1.5 px-4 py-1.5 text-[0.9375rem] [&_svg:not([class*='size-'])]:size-4",
        lg: "min-h-14 gap-2.5 px-6 py-3 text-lg",
        icon: "size-12",
        "icon-xs": "size-11 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-11",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
