import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import {
  ArrowRightIcon,
  AwardIcon,
  FileCheckIcon,
  LockIcon,
  TrendingDownIcon,
} from "lucide-react";

import { PageHeader, SourceLine, Stat } from "~/components/kit";
import { PowiatNeeds } from "~/components/municipality/powiat-needs";
import { requireStaff } from "~/components/layout/staff-gate";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { canSeeNeeds } from "~/server/adapt/needs-count";
import {
  K_ANONYMITY,
  kindLabel,
  pct,
  powiatDisplay,
  signedPct,
} from "~/server/adapt/profile";
import { api } from "~/trpc/server";

type Params = Promise<{ teryt: string }>;

const getProfile = cache((teryt: string) =>
  /^\d{7}$/.test(teryt) ? api.municipality.profile({ teryt }) : null,
);

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const t = await getTranslations("municipality.profile");
  const data = await getProfile((await params).teryt);
  if (!data) return { title: t("metaNotFound") };
  return {
    title: t("metaTitle", { name: data.profile.name }),
    description: t("metaDescription", { name: data.profile.name }),
  };
}

export default async function MunicipalityProfilePage({
  params,
}: {
  params: Params;
}) {
  const data = await getProfile((await params).teryt);
  if (!data) notFound();
  const [t, locale, staff] = await Promise.all([
    getTranslations("municipality.profile"),
    getLocale(),
    requireStaff(["jst"]),
  ]);
  const { profile: p, gus, signals, recommendations } = data;
  // Needs are for ROPS and a logged-in gmina only (the server sends them
  // only to them; the page checks the session as well).
  const needs = canSeeNeeds(staff) ? data.needs : null;

  const gusSource = t("gusSourceShort", { year: String(p.year) });
  // The first fitting innovation on this page is the one to plan first.
  const top = recommendations[0];
  const planHref = top
    ? `/adapt?innovation=${encodeURIComponent(top.slug)}&gmina=${p.teryt}`
    : `/adapt?gmina=${p.teryt}`;
  const powiat = powiatDisplay(p.powiatName, locale);
  const where = `${kindLabel(p.kind, locale)}, ${powiat}`;
  const years = { from: String(gus.baseYear), to: String(p.year) };
  const lead = [
    t("lead", {
      count: p.population,
      share65: pct(p.share65, locale),
      share80: pct(p.share80, locale),
    }),
    p.popChange10y === null
      ? null
      : p.popChange10y < 0
        ? t("leadFell", { ...years, change: pct(Math.abs(p.popChange10y), locale) })
        : t("leadGrew", { ...years, change: pct(p.popChange10y, locale) }),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t("breadcrumb"), href: "/municipality" }]}
        eyebrow={t("eyebrow", { where })}
        title={p.name}
        lead={<p>{lead}</p>}
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={planHref}>
              {t("plan")}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/municipality?powiat=${p.powiatTeryt}#gminy-${p.powiatTeryt}`}>
              {t("others", { powiat })}
            </Link>
          </Button>
        </div>
        {top ? (
          <p className="text-foreground/85 mt-3 text-[0.9375rem]">
            {t.rich("planNote", {
              title: top.title,
              t: (chunks) => (
                <span lang={top.lang === locale ? undefined : top.lang}>
                  {chunks}
                </span>
              ),
            })}
          </p>
        ) : null}
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {/* ---------------------------------------------------------- profile */}
        <section aria-labelledby="profile-h">
          <h2 id="profile-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t("residentsHeading")}
          </h2>
          {p.depopulating && p.popChange10y !== null ? (
            <Alert variant="warning" role="note" className="mt-4 max-w-3xl">
              <TrendingDownIcon aria-hidden="true" />
              <AlertTitle>{t("fallingTitle")}</AlertTitle>
              <AlertDescription>
                {t("fallingBody", {
                  ...years,
                  change: signedPct(p.popChange10y, locale),
                })}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              value={p.population}
              label={t("statPopulation")}
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={p.year}
            />
            <Stat
              value={p.pop65}
              label={t("stat65", { share: pct(p.share65, locale) })}
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={p.year}
            />
            <Stat
              value={p.pop80}
              label={t("stat80", {
                share: pct(p.share80, locale),
                median: pct(p.medianShare80, locale),
              })}
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={p.year}
            />
            <Stat
              value={
                p.popChange10y === null
                  ? t("statChangeNone")
                  : signedPct(p.popChange10y, locale)
              }
              label={
                p.popChange10y === null
                  ? t("statChangeLabelNone", years)
                  : p.popChange10y < 0
                    ? t("statChangeLabelFalling", years)
                    : t("statChangeLabelGrowing", years)
              }
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={`${gus.baseYear}–${p.year}`}
            />
          </div>
          <SourceLine
            className="mt-6"
            source={t("gusSource", { source: gus.name, year: String(p.year), gmina: p.name })}
            href={gus.url}
            date={gus.capturedAt}
          />
        </section>

        {/* ------------------------------------------------------------ needs */}
        {needs ? (
          <section aria-labelledby="needs-h" className="border-hairline mt-14 border-t pt-10">
            <h2 id="needs-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t("needsHeading")}
            </h2>
            <p className="text-muted-foreground mt-2 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <LockIcon aria-hidden="true" className="size-4 shrink-0" />
              {t("needsStaffNote")}
            </p>
            <p className="text-foreground/85 mt-2 max-w-[68ch]">
              {t("needsIntro", { days: needs.windowDays, powiat, k: K_ANONYMITY })}
            </p>
            <PowiatNeeds needs={needs} powiat={powiat} captionId="needs-caption" />
          </section>
        ) : (
          <p className="border-hairline text-muted-foreground mt-14 flex items-center gap-2 border-t pt-6 text-[0.9375rem]">
            <LockIcon aria-hidden="true" className="size-4 shrink-0" />
            {t("needsHidden")}
          </p>
        )}

        {/* ---------------------------------------------------- recommendations */}
        <section aria-labelledby="recs-h" className="border-hairline mt-14 border-t pt-10">
          <h2 id="recs-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t("recsHeading")}
          </h2>
          <div className="border-primary mt-4 max-w-3xl border-l-4 pl-5">
            <h3 className="text-lg font-bold">{t("why")}</h3>
            <ul className="mt-2 space-y-2">
              {signals.map((s, i) => (
                <li key={`${s.id}-${i}`} className="flex gap-2">
                  <span aria-hidden="true" className="text-primary font-bold">→</span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-[0.9375rem]">{t("ruleNote")}</p>
          </div>

          {recommendations.length > 0 ? (
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {recommendations.map((r) => {
                const lang = r.lang === locale ? undefined : r.lang;
                return (
                  <li key={r.id}>
                    <article className="border-hairline flex h-full flex-col rounded-lg border p-5 md:p-6">
                      {r.categoryLabels.length ? (
                        <p lang={lang} className="text-muted-foreground mb-2 text-sm font-bold tracking-wide">
                          {r.categoryLabels.join(" · ")}
                        </p>
                      ) : null}
                      <h3 lang={lang} className="font-display text-xl leading-snug font-bold tracking-tight">
                        <Link
                          href={`/library/${r.slug}`}
                          className="text-foreground decoration-primary decoration-2 underline-offset-4 hover:underline"
                        >
                          {r.title}
                        </Link>
                      </h3>
                      <p lang={lang} className="text-foreground/85 mt-2 line-clamp-3 text-base leading-snug">
                        {r.summary}
                      </p>
                      {r.matches.length ? (
                        <div className="mt-4">
                          <p className="text-sm font-bold">{t("fitsBecause")}</p>
                          <ul className="mt-1 space-y-1 text-[0.9375rem]">
                            {r.matches.map((m) => (
                              <li key={m.theme}>
                                <span className="font-semibold">{m.label}</span>{" "}
                                <span className="text-foreground/85">({m.evidence})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {r.ramowyPlan || r.badge ? (
                        <div className="mt-4 space-y-1 text-sm font-bold">
                          {r.ramowyPlan ? (
                            <p className="flex items-center gap-2">
                              <FileCheckIcon aria-hidden="true" className="text-brand-accent size-5 shrink-0" />
                              {t("ramowy")}
                            </p>
                          ) : null}
                          {r.badge ? (
                            <p className="flex items-center gap-2">
                              <AwardIcon aria-hidden="true" className="text-brand-accent size-5 shrink-0" />
                              {t("badge")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-auto pt-5">
                        <Button asChild variant="secondary" className="w-full sm:w-auto">
                          <Link href={`/adapt?innovation=${encodeURIComponent(r.slug)}&gmina=${p.teryt}`}>
                            {t("planOne")}
                            <span className="sr-only">: {r.title}</span>
                            <ArrowRightIcon aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-6">
              {t("noRecs")}{" "}
              <Link href="/library" className="font-semibold underline underline-offset-4">
                {t("browseLibrary")}
              </Link>
              .
            </p>
          )}
          <SourceLine
            className="mt-6"
            source={t("librarySource")}
            href="https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych"
            date={data.libraryCapturedAt}
          />
        </section>
      </div>
    </>
  );
}
