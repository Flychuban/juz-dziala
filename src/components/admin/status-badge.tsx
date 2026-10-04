import { CheckIcon } from "lucide-react";

import { useLabels } from "~/i18n/use-labels";
import { type InnovationStatus } from "~/lib/domain";
import { cn } from "~/lib/utils";

/** Card status in words (never colour alone): Szkic · Sprawdzona · Opublikowana. */
export function StatusBadge({ status }: { status: InnovationStatus }) {
  const L = useLabels();
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-sm border px-2 py-0.5 text-sm font-semibold whitespace-nowrap",
        status === "published" &&
          "border-primary bg-primary text-primary-foreground",
        status === "verified" && "border-primary text-primary bg-background",
        status === "draft" && "border-input bg-background border-dashed",
      )}
    >
      {status === "published" ? (
        <CheckIcon aria-hidden="true" className="size-4" />
      ) : null}
      {L.innovationStatus[status]}
    </span>
  );
}
