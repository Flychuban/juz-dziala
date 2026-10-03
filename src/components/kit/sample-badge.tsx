import { cn } from "~/lib/utils";

/**
 * SampleBadge — marks fictional/demo records: „przykładowe".
 * Put it next to the name of every person, organisation or figure flagged
 * `isSample`. The screen-reader text explains what it means.
 *
 * @param label  Override the visible word, e.g. „przykładowy" / „przykładowa".
 */
export function SampleBadge({
  label = "przykładowe",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      data-slot="sample-badge"
      className={cn(
        "border-input text-foreground inline-flex w-fit items-center rounded-sm border border-dashed px-1.5 py-px align-middle text-sm leading-snug font-semibold",
        className,
      )}
    >
      {label}
      <span className="sr-only"> (dane przykładowe, nieprawdziwe)</span>
    </span>
  );
}
