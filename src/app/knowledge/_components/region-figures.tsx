import { useLocale, useTranslations } from "next-intl";

import { ExternalLink, SourceLine, Stat } from "~/components/kit";
import { INTL_LOCALE } from "~/i18n/config";
import { cn } from "~/lib/utils";
import type { RankedGmina, RegionFigures } from "~/server/knowledge/region";

export const GUS_BDL_URL = "https://bdl.stat.gov.pl/bdl/start";
export const OBSERWATOR_URL = "https://obserwator.rops.krakow.pl";

/** „19,2%" / „19.2%"; with `signed`, „+1,7%" / „−6,4%". */
export function formatPercent(value: number, locale: string, signed = false) {
  return new Intl.NumberFormat(
    INTL_LOCALE[locale === "en" ? "en" : "pl"],
    {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: signed ? "exceptZero" : "auto",
    },
  ).format(value / 100);
}

const KINDS = ["miejska", "wiejska", "miejsko-wiejska"] as const;
const isKind = (k: string | null): k is (typeof KINDS)[number] =>
  !!k && (KINDS as readonly string[]).includes(k);

function GminaList({
  heading,
  lead,
  items,
  signed,
}: {
  heading: string;
  lead: string;
  items: RankedGmina[];
  signed: boolean;
}) {
  const t = useTranslations("knowledge.region");
  const locale = useLocale();
  return (
    <div className="min-w-0">
      <h3 className="font-display text-xl leading-snug font-bold">{heading}</h3>
      <p className="text-foreground/85 mt-1 text-base">{lead}</p>
      <ol className="divide-hairline border-hairline mt-4 divide-y border-y">
        {items.map((g) => (
          <li
            key={`${g.name}-${g.kind ?? ""}`}
            className="flex items-baseline justify-between gap-4 py-3"
          >
            <span className="min-w-0">
              <span className="font-semibold">{g.name}</span>
              <span className="text-foreground/85 block text-[0.9375rem]">
                {isKind(g.kind) ? t(`kind.${g.kind}`) : null}
                {isKind(g.kind) && g.powiatName ? " · " : null}
                {g.powiatName ? (
                  <span lang={locale === "en" ? "pl" : undefined}>
                    {g.powiatName}
                  </span>
                ) : null}
              </span>
            </span>
            <span className="tabular shrink-0 text-lg font-bold">
              {formatPercent(g.value, locale, signed)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * „Małopolska w liczbach" — regional GUS figures, always labelled
 * „Małopolska" and kept apart from the national figures of the Mapa
 * Wyzwań. `variant` decides which figures are shown:
 * - "overview": population, ageing, change, depopulation, fastest growth;
 * - "seniors": ageing first, the oldest gminas, depopulation;
 * - "other": only population, change and depopulation — GUS data do not
 *   describe the other areas, so no area-specific figure is invented.
 */
export function RegionFiguresBlock({
  data,
  variant,
  className,
}: {
  data: RegionFigures;
  variant: "overview" | "seniors" | "other";
  className?: string;
}) {
  const t = useTranslations("knowledge.region");
  const ts = useTranslations("knowledge.scope");
  const locale = useLocale();
  const scope = ts("region");
  const year = data.year ?? undefined;
  const from = data.baseYear;
  const span = from && year ? { from, to: year } : null;
  const source = t("statSource");
  const fmt = (n: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale === "en" ? "en" : "pl"]).format(n);

  const stats: {
    key: string;
    value: number | string;
    label: string;
    year?: string | number;
  }[] = [];
  const population = {
    key: "population",
    value: data.population,
    label: t("population"),
    year,
  };
  const share65 = {
    key: "share65",
    value: formatPercent(data.share65, locale),
    label: t("share65", { count: fmt(data.pop65) }),
    year,
  };
  const share80 = {
    key: "share80",
    value: formatPercent(data.share80, locale),
    label: t("share80", { count: fmt(data.pop80) }),
    year,
  };
  const change =
    data.change && span
      ? {
          key: "change",
          value: data.change.approx
            ? t("approx", {
                value: formatPercent(data.change.pct, locale, true),
              })
            : formatPercent(data.change.pct, locale, true),
          label: t("change", span),
          year: `${span.from}–${span.to}`,
        }
      : null;
  const depop = span
    ? {
        key: "depop",
        value: t("outOf", {
          count: data.depopulating.count,
          of: data.depopulating.of,
        }),
        label: t("depop", span),
        year: `${span.from}–${span.to}`,
      }
    : null;
  const quarter = {
    key: "quarter65",
    value: t("outOf", { count: data.gminas65Quarter, of: data.gminaCount }),
    label: t("quarter65"),
    year,
  };

  if (variant === "seniors")
    stats.push(share65, share80, quarter, ...(depop ? [depop] : []));
  else if (variant === "other")
    stats.push(
      population,
      ...(change ? [change] : []),
      ...(depop ? [depop] : []),
    );
  else
    stats.push(
      population,
      share65,
      share80,
      ...(change ? [change] : []),
      ...(depop ? [depop] : []),
    );

  const lead =
    variant === "seniors"
      ? t("leadSeniors", { gminas: data.gminaCount })
      : variant === "other"
        ? t("leadOther", { gminas: data.gminaCount })
        : t("lead", { gminas: data.gminaCount });

  const showChangeNote =
    stats.some((s) => s.key === "change") &&
    (data.change?.excluded.length ?? 0) > 0 &&
    !!from;

  return (
    <section
      aria-labelledby="region-heading"
      className={cn("border-hairline border-t pt-10", className)}
    >
      <h2
        id="region-heading"
        className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
      >
        {t("heading")}
      </h2>
      <p className="text-foreground/85 mt-2 max-w-[68ch]">{lead}</p>

      <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <li key={s.key}>
            <Stat
              value={s.value}
              label={s.label}
              scope={scope}
              year={s.year}
              source={source}
              sourceHref={GUS_BDL_URL}
            />
          </li>
        ))}
      </ul>

      {variant === "overview" && span && data.fastestGrowing.length > 0 ? (
        <div className="mt-12 max-w-2xl">
          <GminaList
            heading={
              data.fastestAroundKrakow ? t("growingKrakow") : t("growing")
            }
            lead={t("growingLead", span)}
            items={data.fastestGrowing}
            signed
          />
        </div>
      ) : null}
      {variant === "seniors" && data.oldest.length > 0 && year ? (
        <div className="mt-12 max-w-2xl">
          <GminaList
            heading={t("oldest")}
            lead={t("oldestLead", { year })}
            items={data.oldest}
            signed={false}
          />
        </div>
      ) : null}

      <div className="mt-10 space-y-2">
        {showChangeNote ? (
          <p className="text-muted-foreground max-w-[68ch] text-[0.9375rem]">
            {t("changeNote", {
              count: data.change!.gminas,
              from: from,
              names: data.change!.excluded.join(", "),
            })}
          </p>
        ) : null}
        <SourceLine
          source={t("source")}
          href={GUS_BDL_URL}
          detail={
            data.subjectId && year
              ? t("sourceDetail", { subject: data.subjectId, year })
              : null
          }
          date={data.capturedAt}
        />
        <p className="text-[0.9375rem]">
          <span className="text-muted-foreground font-semibold">
            {t("more")}
          </span>{" "}
          <ExternalLink href={OBSERWATOR_URL} className="font-semibold">
            {t("moreLink")}
          </ExternalLink>
        </p>
      </div>
    </section>
  );
}
