import { useLocale, useTranslations } from "next-intl";

import { cn } from "~/lib/utils";
import { formatDate, isoDate } from "./format";

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
  label,
  className,
}: {
  source: string;
  href?: string | null;
  date?: Date | string | null;
  detail?: string | null;
  label?: string;
  className?: string;
}) {
  const t = useTranslations("common.kit.source");
  const formatted = formatDate(date, useLocale());
  return (
    <p
      data-slot="source-line"
      className={cn(
        "text-muted-foreground text-[0.9375rem] leading-snug",
        className,
      )}
    >
      <span className="font-semibold">{label ?? t("label")}:</span>{" "}
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
          , {t("asOf")} <time dateTime={isoDate(date)}>{formatted}</time>
        </>
      ) : null}
    </p>
  );
}
