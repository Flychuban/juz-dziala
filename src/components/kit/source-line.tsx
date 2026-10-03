import { cn } from "~/lib/utils";
import { formatDatePl, isoDate } from "./format";

/**
 * SourceLine — the line under every claim:
 * „Źródło: Biblioteka Innowacji Społecznych ROPS Kraków, stan na 3 października 2026".
 *
 * @param source  Name of the source, as a reader would recognise it.
 * @param href    Link to the exact source document or page (opens in place).
 * @param date    Capture or publication date (Date | ISO string); formatted pl-PL.
 * @param detail  Optional precision after the name, e.g. „s. 12–14".
 * @param label   Prefix; defaults to „Źródło".
 *
 * Server- and client-safe.
 */
export function SourceLine({
  source,
  href,
  date,
  detail,
  label = "Źródło",
  className,
}: {
  source: string;
  href?: string | null;
  date?: Date | string | null;
  detail?: string | null;
  label?: string;
  className?: string;
}) {
  const formatted = formatDatePl(date);
  return (
    <p
      data-slot="source-line"
      className={cn(
        "text-muted-foreground text-[0.9375rem] leading-snug",
        className,
      )}
    >
      <span className="font-semibold">{label}:</span>{" "}
      {href ? (
        <a
          href={href}
          className="text-foreground decoration-input hover:decoration-foreground underline decoration-1 underline-offset-4"
        >
          {source}
        </a>
      ) : (
        <span className="text-foreground">{source}</span>
      )}
      {detail ? <>, {detail}</> : null}
      {formatted ? (
        <>
          , stan na <time dateTime={isoDate(date)}>{formatted}</time>
        </>
      ) : null}
    </p>
  );
}
