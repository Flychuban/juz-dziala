import { cn } from "~/lib/utils";

/**
 * EmptyState — what to show when there is nothing to show: a plain title,
 * one sentence on why, and the next step (a link or button) so the person
 * is never left at a dead end.
 *
 * @param title        Short statement, e.g. „Nic nie znaleźliśmy".
 * @param description  Why, and what to try.
 * @param action       One or more links/buttons.
 * @param headingLevel h2 (default) or h3, to fit the page outline.
 * @param icon         Optional decorative lucide icon element.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel = "h2",
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const H = headingLevel;
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "border-input bg-background rounded-lg border border-dashed px-6 py-10 md:px-10",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="text-primary mb-4 [&_svg]:size-8 [&_svg]:stroke-[1.5]"
        >
          {icon}
        </div>
      ) : null}
      <H className="font-display text-2xl font-bold tracking-tight">{title}</H>
      {description ? (
        <div className="text-foreground/85 mt-2 max-w-[60ch] text-base">
          {description}
        </div>
      ) : null}
      {action ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">{action}</div>
      ) : null}
    </div>
  );
}
