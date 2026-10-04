import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, LanguagesIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import {
  EmptyState,
  ExternalLink,
  InnovationCard,
  PageHeader,
  SourceLine,
  Stat,
} from "~/components/kit";
import { Button } from "~/components/ui/button";
import {
  labelsFor,
  MAPA_AREAS,
  mapaAreaSchema,
  type MapaArea,
} from "~/lib/domain";
import { api } from "~/trpc/server";
import { RegionFiguresBlock } from "../_components/region-figures";

type Params = Promise<{ area: string }>;

const getArea = cache((key: MapaArea) => api.knowledge.area({ key }));

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const [t, locale] = await Promise.all([
    getTranslations("knowledge.area"),
    getLocale(),
  ]);
  const parsed = mapaAreaSchema.safeParse((await params).area);
  if (!parsed.success) return { title: t("notFound") };
  return {
    title: t("metaTitle", { area: labelsFor(locale).area[parsed.data] }),
  };
}

/** [12, 13, 14, 20] → „12–14, 20". */
function pageRanges(pages: (number | string)[]) {
  const nums = [
    ...new Set(pages.map((p) => Number(p)).filter(Number.isFinite)),
  ].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    const start = nums[i]!;
    let end = start;
    while (nums[i + 1] === end + 1) end = nums[++i]!;
    parts.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return parts.join(", ");
}

const SHOWN = 6;

export default async function KnowledgeAreaPage({
  params,
}: {
  params: Params;
}) {
  const parsed = mapaAreaSchema.safeParse((await params).area);
  if (!parsed.success) notFound();
  const key = parsed.data;
  const [{ area, source, innovations, label, region }, t, ts, locale] =
    await Promise.all([
      getArea(key),
      getTranslations("knowledge.area"),
      getTranslations("knowledge.scope"),
      getLocale(),
    ]);
  const labels = labelsFor(locale);

  const sourceName = source?.name ?? "Mapa Wyzwań Społecznych";
  const pages = area ? pageRanges(area.pages) : "";
  const figures = area?.figures ?? [];
  const persona = area?.persona;
  const others = MAPA_AREAS.filter((a) => a !== key);
  /** lang="pl" on Mapa text an English reader gets untranslated (WCAG 3.1.2). */
  const contentLang = locale === "en" && area?.lang === "pl" ? "pl" : undefined;
  const scopeLabel = (s: string | null | undefined) => {
    const v = s?.trim() ? s.trim() : "Polska";
    if (v === "Polska" || v === "Poland") return ts("poland");
    if (v === "Małopolska") return ts("region");
    return v;
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t("breadcrumb"), href: "/knowledge" }]}
        eyebrow={t("eyebrow")}
        title={area?.label ?? label}
        lead={
          area?.definition ? (
            <p lang={contentLang}>{area.definition}</p>
          ) : (
            <p>{t("leadMissing")}</p>
          )
        }
      >
        {locale === "en" && area?.lang === "en" ? (
          <p className="text-foreground/85 flex max-w-[68ch] items-start gap-2 text-base">
            <LanguagesIcon
              aria-hidden="true"
              className="text-primary mt-1 size-5 shrink-0"
            />
            <span>{t("translated")}</span>
          </p>
        ) : null}
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {area ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
            <section aria-labelledby="challenges-heading">
              <h2
                id="challenges-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
              >
                {t("challenges")}
              </h2>
              {area.keyChallenges.length > 0 ? (
                <ol className="mt-6 max-w-[68ch] space-y-4" lang={contentLang}>
                  {area.keyChallenges.map((c, i) => (
                    <li key={i} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="font-display text-primary tabular w-7 shrink-0 text-lg leading-[1.6] font-bold"
                      >
                        {i + 1}.
                      </span>
                      <span className="min-w-0">{c}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground mt-4">
                  {t("noChallenges")}
                </p>
              )}
            </section>

            {persona ? (
              <section
                aria-labelledby="persona-heading"
                className="border-hairline bg-surface self-start rounded-lg border p-6"
              >
                <p className="text-muted-foreground text-sm font-bold tracking-wide">
                  {t("personaEyebrow")}
                </p>
                <h2
                  id="persona-heading"
                  className="font-display mt-1 text-2xl font-bold tracking-tight"
                >
                  {t("personaTitle", { name: persona.name })}
                  {persona.age ? `, ${persona.age}` : ""}
                </h2>
                {persona.description ? (
                  <p className="mt-3 text-base" lang={contentLang}>
                    {persona.description}
                  </p>
                ) : null}
                {(
                  [
                    [t("personaGoals"), persona.goals],
                    [t("personaChallenges"), persona.challenges],
                    [t("personaMotivations"), persona.motivations],
                  ] as const
                ).map(([title, list]) =>
                  list.length > 0 ? (
                    <div
                      key={title}
                      className="border-hairline mt-5 border-t pt-4"
                    >
                      <h3 className="text-base font-bold">{title}</h3>
                      <ul
                        className="marker:text-primary mt-2 list-disc space-y-1 pl-5 text-base"
                        lang={contentLang}
                      >
                        {list.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
                <p className="text-muted-foreground mt-5 text-sm">
                  {t("personaNote")}
                </p>
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title={t("emptyTitle")}
            description={<p>{t("emptyBody")}</p>}
          />
        )}

        {region ? (
          <RegionFiguresBlock
            data={region}
            variant={key === "seniors" ? "seniors" : "other"}
            className="mt-14"
          />
        ) : null}

        {figures.length > 0 ? (
          <section
            aria-labelledby="figures-heading"
            className="border-hairline mt-14 border-t pt-10"
          >
            <h2
              id="figures-heading"
              className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
            >
              {t("nationalHeading")}
            </h2>
            <p className="text-foreground/85 mt-2 max-w-[68ch]">
              {t("nationalLead")}
            </p>
            <ul
              className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
              lang={contentLang}
            >
              {figures.map((f, i) => (
                <li key={i}>
                  <Stat
                    value={f.value}
                    label={f.label}
                    scope={scopeLabel(f.scope)}
                    year={f.year}
                    source={
                      f.page
                        ? `${sourceName}, ${t("page", { page: String(f.page) })}`
                        : sourceName
                    }
                    sourceHref={source?.url}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="innovations-heading"
          className="border-hairline mt-14 border-t pt-10"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="innovations-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
              >
                {t("innovations")}
              </h2>
              <p className="text-foreground/85 mt-2">
                {t("inLibrary")}{" "}
                <span className="tabular font-semibold">
                  {t("count", { count: innovations.length })}
                </span>
              </p>
            </div>
            {innovations.length > SHOWN ? (
              <Button asChild variant="secondary">
                <Link href={`/library?area=${key}`}>
                  {t("seeAll", { count: innovations.length })}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>
          {innovations.length > 0 ? (
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {innovations.slice(0, SHOWN).map((item) => (
                <li
                  key={item.id}
                  lang={
                    locale === "en" && item.lang === "pl" ? "pl" : undefined
                  }
                >
                  <InnovationCard item={item} headingLevel="h3" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-foreground/85 mt-4">
              {t("noInnovations")}{" "}
              <Link
                href="/ideas/new"
                className="font-semibold underline underline-offset-4"
              >
                {t("haveIdea")}
              </Link>
            </p>
          )}
        </section>

        {area && area.reports.length > 0 ? (
          <section
            aria-labelledby="reports-heading"
            className="border-hairline mt-14 border-t pt-10"
          >
            <h2
              id="reports-heading"
              className="font-display text-2xl leading-tight font-bold tracking-tight"
            >
              {t("reports")}
            </h2>
            {locale === "en" ? (
              <p className="text-foreground/85 mt-2">{t("reportsLang")}</p>
            ) : null}
            <ul className="mt-4 max-w-[68ch] space-y-2" lang={contentLang}>
              {area.reports.map((r, i) => (
                <li key={i}>
                  {r.url ? (
                    <ExternalLink
                      href={r.url}
                      className="inline-flex min-h-11 items-center font-semibold"
                    >
                      {r.title}
                    </ExternalLink>
                  ) : (
                    <span className="font-semibold">{r.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="border-hairline mt-14 space-y-1 border-t pt-6">
          {area ? (
            <SourceLine
              source={sourceName}
              href={source?.url}
              detail={
                pages
                  ? /[–,]/.test(pages)
                    ? t("pages", { pages })
                    : t("page", { page: pages })
                  : null
              }
              date={source?.date}
            />
          ) : null}
          <SourceLine
            label={t("solutionsLabel")}
            source={t("librarySource")}
            href={`/library?area=${key}`}
          />
        </div>

        <nav aria-labelledby="other-areas" className="mt-12">
          <h2 id="other-areas" className="font-display text-xl font-bold">
            {t("otherAreas")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((a) => (
              <li key={a}>
                <Link
                  href={`/knowledge/${a}`}
                  className="border-input hover:bg-surface inline-flex min-h-11 max-w-full items-center rounded-md border px-3 text-[0.9375rem] font-semibold [overflow-wrap:anywhere] no-underline"
                >
                  {labels.area[a]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
