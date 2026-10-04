import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { DownloadIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { CallTopicButton } from "~/components/admin/call-topic-button";
import {
  EmptyState,
  formatDate,
  formatNumber,
  SampleBadge,
  SourceLine,
} from "~/components/kit";
import { PowiatMap } from "~/components/map";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { labelsFor, MAPA_AREAS, mapaAreaSchema } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { TREND_DAYS } from "~/server/admin/trends";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.trends");
  return { title: t("metaTitle") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const SELECT =
  "border-input bg-background text-foreground min-h-12 w-full rounded-md border-2 px-3 text-base";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("admin.trends"),
    getLocale(),
  ]);
  const L = labelsFor(locale);
  const sp = await searchParams;
  const areaParsed = mapaAreaSchema.safeParse(one(sp.area));
  const area = areaParsed.success ? areaParsed.data : null;
  const daysRaw = Number(one(sp.days) || 30);
  const days = (
    (TREND_DAYS as readonly number[]).includes(daysRaw) ? daysRaw : 30
  ) as 7 | 30 | 90;

  const [overview, spots] = await Promise.all([
    api.admin.trends.overview({ area, days }),
    api.admin.trends.whiteSpots({ area, days }),
  ]);
  const maxArea = Math.max(1, ...overview.byArea.map((a) => a.count));
  const allSample = overview.total > 0 && overview.sample === overview.total;
  const scope = t("scope", {
    area: area ? L.area[area] : t("allAreasScope"),
    days,
  });
  const csvHref = `/admin/trends/export?days=${days}${area ? `&area=${area}` : ""}`;
  const source = <SourceLine source={t("source")} date={new Date()} />;

  return (
    <>
      <AdminHeader title={t("title")} lead={<p>{t("lead")}</p>}>
        <form
          method="get"
          action="/admin/trends"
          className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <label htmlFor="t-area" className="block font-semibold">
              {t("filterArea")}
            </label>
            <select
              id="t-area"
              name="area"
              defaultValue={area ?? ""}
              className={cn(SELECT, "mt-2")}
            >
              <option value="">{t("allAreas")}</option>
              {MAPA_AREAS.map((a) => (
                <option key={a} value={a}>
                  {L.area[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="t-days" className="block font-semibold">
              {t("filterDays")}
            </label>
            <select
              id="t-days"
              name="days"
              defaultValue={String(days)}
              className={cn(SELECT, "mt-2")}
            >
              {TREND_DAYS.map((d) => (
                <option key={d} value={d}>
                  {t("lastDays", { days: d })}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">{t("show")}</Button>
        </form>
      </AdminHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="totals-heading">
          <h2 id="totals-heading" className="sr-only">
            {t("summaryHeading")}
          </h2>
          {allSample ? (
            <p className="mb-6 flex flex-wrap items-center gap-2">
              <SampleBadge label={t("allSampleBadge")} />
              {t("allSample")}
            </p>
          ) : overview.sample > 0 ? (
            <p className="mb-6 flex flex-wrap items-center gap-2">
              <SampleBadge />
              {t("someSample", { count: overview.sample })}
            </p>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
            {[
              { label: t("totals.total"), value: overview.total },
              { label: t("totals.unmet"), value: overview.unmet },
              { label: t("totals.withPowiat"), value: overview.withPowiat },
            ].map((s) => (
              <div key={s.label} className="border-hairline border-t-2 pt-4">
                <dt className="text-base">{s.label}</dt>
                <dd className="font-display tabular mt-1 text-5xl font-bold">
                  {formatNumber(s.value, locale)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-4 text-sm">
            {t("range", { scope })} {t("junkNote")}
          </p>
        </section>

        {overview.total === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={<p>{t("emptyBody")}</p>}
          />
        ) : (
          <>
            <section aria-labelledby="map-heading">
              <h2
                id="map-heading"
                className="font-display text-2xl font-bold md:text-3xl"
              >
                {t("map.heading")}
              </h2>
              <p className="text-foreground/85 mt-2 max-w-[68ch]">
                {t("map.lead", { scope })}
              </p>
              <div className="mt-6">
                <PowiatMap
                  values={overview.byPowiat}
                  label={t("map.label", { scope })}
                  valueLabel={t("map.value")}
                  source={source}
                />
              </div>
            </section>

            <section aria-labelledby="areas-heading">
              <h2
                id="areas-heading"
                className="font-display text-2xl font-bold md:text-3xl"
              >
                {t("areas.heading")}
              </h2>
              <p className="text-foreground/85 mt-2 max-w-[68ch]">
                {t("areas.lead")}
              </p>
              <ul className="mt-6 max-w-4xl space-y-4">
                {overview.byArea.map((a) => (
                  <li
                    key={a.area}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center"
                  >
                    <span className="font-semibold">{a.label}</span>
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-surface border-hairline flex h-6 flex-1 overflow-hidden rounded-sm border"
                      >
                        <span
                          className="bg-primary h-full"
                          style={{
                            width: `${((a.count - a.unmet) / maxArea) * 100}%`,
                          }}
                        />
                        <span
                          className="bg-foreground h-full border-l-2 border-[var(--background)]"
                          style={{ width: `${(a.unmet / maxArea) * 100}%` }}
                        />
                      </span>
                      <span className="tabular w-40 shrink-0 text-[0.9375rem] sm:w-72">
                        <span className="font-bold">{a.count}</span>
                        {a.unmet
                          ? t("areas.unmetPart", { count: a.unmet })
                          : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p
                className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm"
                aria-hidden="true"
              >
                <span className="flex items-center gap-2">
                  <span className="bg-primary inline-block size-4 rounded-sm" />{" "}
                  {t("areas.legendMatched")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="bg-foreground inline-block size-4 rounded-sm" />{" "}
                  {t("areas.legendUnmet")}
                </span>
              </p>
            </section>

            <section aria-labelledby="weeks-heading">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2
                  id="weeks-heading"
                  className="font-display text-2xl font-bold md:text-3xl"
                >
                  {t("weeks.heading")}
                </h2>
                <Button asChild variant="secondary">
                  <a href={csvHref} download>
                    <DownloadIcon aria-hidden="true" />
                    {t("weeks.csv")}
                  </a>
                </Button>
              </div>
              <div className="mt-6 max-w-2xl">
                <Table>
                  <TableCaption>{t("weeks.caption", { scope })}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("weeks.weekFrom")}</TableHead>
                      <TableHead className="text-right">
                        {t("weeks.needs")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("weeks.unmet")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.byWeek.map((w) => (
                      <TableRow key={w.week}>
                        <TableCell>{formatDate(w.week, locale)}</TableCell>
                        <TableCell className="text-right">{w.count}</TableCell>
                        <TableCell className="text-right">{w.unmet}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}

        <section
          aria-labelledby="spots-heading"
          className="border-hairline border-t pt-10"
        >
          <h2
            id="spots-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            {t("spots.heading")}
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            {t("spots.lead")}
          </p>
          {spots.length === 0 ? (
            <p className="mt-6 font-semibold">{t("spots.none")}</p>
          ) : (
            <ol className="mt-8 grid grid-cols-1 gap-x-12 lg:grid-cols-2">
              {spots.slice(0, 12).map((s) => (
                <li
                  key={`${s.area}-${s.powiat}`}
                  className="border-hairline border-t pt-5 pb-8"
                >
                  <h3 className="font-display text-xl font-bold">
                    {s.areaLabel} · {s.powiatName}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="tabular font-semibold">
                      {t("spots.count", { count: s.count })}
                    </span>
                    {s.sample ? <SampleBadge /> : null}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {s.examples.map((e) => (
                      <li key={e}>
                        <blockquote className="border-input text-foreground/90 border-l-4 pl-3">
                          „{e}”
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                  <CallTopicButton
                    area={s.area}
                    powiat={s.powiat}
                    days={days}
                    label={`${s.areaLabel}, ${s.powiatName}`}
                  />
                </li>
              ))}
            </ol>
          )}
          {spots.length > 12 ? (
            <p className="mt-4 text-[0.9375rem]">
              {t("spots.more", { count: spots.length })}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
