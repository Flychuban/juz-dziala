import { type Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRightIcon, LockIcon, TrendingDownIcon } from "lucide-react";

import { PageHeader, SourceLine } from "~/components/kit";
import { formatNumber } from "~/components/kit/format";
import { requireStaff } from "~/components/layout/staff-gate";
import { PowiatMap } from "~/components/map";
import { powiatName } from "~/components/map/powiaty";
import { GminaSearch } from "~/components/municipality/gmina-search";
import { PowiatNeeds } from "~/components/municipality/powiat-needs";
import { Button } from "~/components/ui/button";
import { kindLabel, pct, powiatDisplay, signedPct } from "~/server/adapt/profile";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("municipality.index");
  return { title: t("title"), description: t("description") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function MunicipalityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const powiatParam = first(sp.powiat);
  const [t, locale, staff, data] = await Promise.all([
    getTranslations("municipality.index"),
    getLocale(),
    requireStaff(["jst"]),
    api.municipality.overview(),
  ]);
  // „Panel gminy": only for a gmina login (ROPS has its own dashboard).
  const panel =
    staff?.role === "jst"
      ? await api.municipality.panel({
          teryt: /^\d{7}$/.test(first(sp.gmina) ?? "") ? first(sp.gmina) : undefined,
        })
      : null;
  const f = data.featured;

  const powiaty = new Map<string, { name: string; gminas: typeof data.gminas }>();
  for (const g of data.gminas) {
    const p = powiaty.get(g.powiatTeryt) ?? { name: g.powiatName, gminas: [] };
    p.gminas.push(g);
    powiaty.set(g.powiatTeryt, p);
  }
  const powiatList = [...powiaty.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const options = data.gminas.map((g) => ({
    teryt: g.teryt,
    name: g.name,
    label: g.label,
    powiatName: powiatName(g.powiatName, locale),
  }));
  const gusLine = (
    <SourceLine
      source={`${data.gus.name}${data.gus.year ? `, ${data.gus.year}` : ""}`}
      href={data.gus.url}
      date={data.gus.capturedAt}
    />
  );

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={<p>{t("lead")}</p>}>
        <GminaSearch options={options} />
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {panel ? (
          <section aria-labelledby="panel-h" className="mb-14">
            <h2 id="panel-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t("panel.heading")}
            </h2>
            <p className="mt-2 max-w-[68ch]">
              {t("panel.account", {
                gmina: panel.gmina.label,
                powiat: powiatDisplay(panel.gmina.powiatName, locale),
              })}
            </p>
            <p className="text-muted-foreground mt-1 max-w-[68ch] text-[0.9375rem]">
              {t("panel.demo")}
            </p>
            <h3 className="mt-6 text-lg font-bold">{t("panel.needsHeading")}</h3>
            <p className="text-muted-foreground mt-1 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <LockIcon aria-hidden="true" className="size-4 shrink-0" />
              {t("panel.private")}
            </p>
            <PowiatNeeds
              needs={panel.needs}
              powiat={powiatDisplay(panel.gmina.powiatName, locale)}
              captionId="panel-needs-caption"
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href={`/adapt?gmina=${panel.gmina.teryt}`}>
                  {t("panel.plan", { gmina: panel.gmina.name })}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/?gmina=${panel.gmina.teryt}`}>{t("panel.challenge")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/municipality/${panel.gmina.teryt}`}>
                  {t("panel.profile")}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </section>
        ) : null}

        {f ? (
          <section
            aria-labelledby="featured-h"
            className={panel ? "border-hairline border-t pt-10" : undefined}
          >
            <p className="text-primary text-[0.9375rem] font-bold tracking-wide">
              {t("featured.eyebrow")}
            </p>
            <h2 id="featured-h" className="font-display mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {t("featured.heading", {
                name: f.name,
                kind: kindLabel(f.kind, locale),
                powiat: powiatDisplay(f.powiatName, locale),
              })}
            </h2>
            <p className="text-foreground/85 mt-2 max-w-[68ch]">{t("featured.why")}</p>
            <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="border-hairline border-t-2 pt-3">
                <dt className="text-foreground text-base">{t("featured.residents")}</dt>
                <dd className="font-display tabular text-3xl font-bold">
                  {formatNumber(f.population, locale)}
                </dd>
              </div>
              <div className="border-hairline border-t-2 pt-3">
                <dt className="text-foreground text-base">
                  {t("featured.share80", { median: pct(f.medianShare80, locale) })}
                </dt>
                <dd className="font-display tabular text-3xl font-bold">
                  {pct(f.share80, locale)}%
                </dd>
              </div>
              {f.popChange10y !== null ? (
                <div className="border-hairline border-t-2 pt-3">
                  <dt className="text-foreground text-base">{t("featured.change")}</dt>
                  <dd className="font-display tabular flex flex-wrap items-center gap-x-2 text-3xl font-bold">
                    {f.popChange10y < 0 ? (
                      <TrendingDownIcon aria-hidden="true" className="text-brand-accent size-7" />
                    ) : null}
                    {signedPct(f.popChange10y, locale)}
                    {f.popChange10y < 0 ? (
                      <span className="text-base font-semibold">{t("featured.falling")}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-6">{gusLine}</div>
            {f.top.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-lg font-bold">{t("featured.topHeading")}</h3>
                <ol className="mt-2 space-y-1">
                  {f.top.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/library/${r.slug}`}
                        lang={r.lang === locale ? undefined : r.lang}
                        className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
                      >
                        {r.title}
                      </Link>
                      {r.matches.length ? (
                        <span className="text-foreground/85"> — {r.matches.join(", ")}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href={`/municipality/${f.teryt}`}>
                  {t("featured.profile", { name: f.name })}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={
                    f.top[0]
                      ? `/adapt?innovation=${encodeURIComponent(f.top[0].slug)}&gmina=${f.teryt}`
                      : `/adapt?gmina=${f.teryt}`
                  }
                >
                  {t("featured.plan")}
                </Link>
              </Button>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="map-h" className="border-hairline mt-14 border-t pt-10">
          <h2 id="map-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t("map.heading")}
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            {t("map.lead", { median: pct(data.medianShare80, locale) })}
          </p>
          <PowiatMap
            className="mt-6"
            values={data.powiatShares80}
            label={
              data.gus.year
                ? t("map.labelYear", { year: String(data.gus.year) })
                : t("map.label")
            }
            valueLabel={t("map.valueLabel")}
            highlight={powiatParam ? [powiatParam] : []}
            highlightLabel={t("map.highlight")}
            hrefFor={(teryt) => `/municipality?powiat=${teryt}#gminy-${teryt}`}
            source={gusLine}
          />
        </section>

        <section aria-labelledby="list-h" className="border-hairline mt-14 border-t pt-10">
          <h2 id="list-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t("list.heading")}
          </h2>
          <p className="text-foreground/85 mt-2">
            {t("list.lead", { gminas: data.gminas.length, powiats: powiatList.length })}
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {powiatList.map(([teryt, p]) => (
              <li key={teryt} id={`gminy-${teryt}`} className="scroll-mt-6">
                <details
                  open={powiatParam === teryt}
                  className="border-hairline group rounded-md border"
                >
                  <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-semibold">
                    <span className="min-w-0">{powiatDisplay(p.name, locale)}</span>
                    <span className="text-muted-foreground tabular shrink-0 text-sm font-normal">
                      {t("list.count", { count: p.gminas.length })}
                    </span>
                  </summary>
                  <div className="border-hairline overflow-x-auto border-t">
                    <table className="tabular w-full text-[0.9375rem]">
                      <caption className="sr-only">
                        {t("list.caption", { powiat: powiatDisplay(p.name, locale) })}
                      </caption>
                      <thead className="bg-surface">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left font-semibold sm:px-4">
                            {t("list.colGmina")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">
                            {t("list.colShare80")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">
                            {t("list.colChange")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.gminas.map((g) => (
                          <tr key={g.teryt} className="border-hairline border-t">
                            <th scope="row" className="px-3 py-1 text-left font-normal sm:px-4">
                              <Link
                                href={`/municipality/${g.teryt}`}
                                className="inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                              >
                                {g.label}
                              </Link>
                            </th>
                            <td className="px-3 py-1 text-right sm:px-4">
                              {pct(g.share80, locale)}%
                            </td>
                            <td className="px-3 py-1 text-right sm:px-4">
                              {g.popChange10y === null ? (
                                <span className="text-muted-foreground">
                                  {t("list.noComparison")}
                                </span>
                              ) : (
                                signedPct(g.popChange10y, locale)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <div className="mt-6">{gusLine}</div>
        </section>
      </div>
    </>
  );
}
