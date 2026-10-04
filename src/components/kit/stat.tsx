import { useLocale, useTranslations } from "next-intl";
import { cn } from "~/lib/utils";
import { formatNumber } from "./format";

/**
 * Stat — one figure with what it measures and where it comes from.
 * A figure without a source is never shown: `source` is required.
 *
 * @param value   The figure (number → pl-PL grouping; string shown as given, e.g. „12,4%").
 * @param label   What it measures, in a plain sentence fragment.
 * @param source  Source in words (and optional link via `sourceHref`), e.g. „Mapa Wyzwań, s. 14".
 * @param scope   Geography of the figure, e.g. „Polska" or „Małopolska" — always visible.
 * @param year    Year the figure describes.
 */
export function Stat({
  value,
  label,
  source,
  sourceHref,
  scope,
  year,
  className,
}: {
  value: number | string;
  label: string;
  source: React.ReactNode;
  sourceHref?: string | null;
  scope?: string | null;
  year?: number | string | null;
  className?: string;
}) {
  const t = useTranslations("common.kit.source");
  const locale = useLocale();
  return (
    <figure
      data-slot="stat"
      className={cn(
        "border-hairline flex h-full flex-col border-t-2 pt-4",
        className,
      )}
    >
      {scope || year ? (
        <p className="text-muted-foreground mb-1 text-sm font-semibold tracking-wide">
          {scope}
          {scope && year ? " · " : null}
          {year ? <span className="tabular">{year}</span> : null}
        </p>
      ) : null}
      <p className="font-display text-foreground tabular text-4xl leading-none font-bold tracking-tight md:text-5xl">
        {formatNumber(value, locale)}
      </p>
      <figcaption className="mt-3 flex flex-1 flex-col gap-3">
        <span className="text-foreground text-base leading-snug">{label}</span>
        <span className="text-muted-foreground mt-auto text-sm leading-snug">
          {t("label")}:{" "}
          {sourceHref ? (
            <a
              href={sourceHref}
              className="text-foreground underline decoration-1 underline-offset-4"
            >
              {source}
            </a>
          ) : (
            source
          )}
        </span>
      </figcaption>
    </figure>
  );
}
