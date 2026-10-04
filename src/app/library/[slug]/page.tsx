import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AwardIcon,
  Building2Icon,
  DownloadIcon,
  FileTextIcon,
  LanguagesIcon,
  MapPinIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import {
  AreaTag,
  EasyText,
  ExternalLink,
  PageHeader,
  ReadAloud,
  SampleBadge,
  SourceLine,
  VideoEmbed,
} from "~/components/kit";
import { PowiatMap } from "~/components/map";
import { Button } from "~/components/ui/button";
import { labelsFor, SECTION_KEYS } from "~/lib/domain";
import { api } from "~/trpc/server";

type Params = Promise<{ slug: string }>;

const getCard = cache((slug: string) => api.library.bySlug({ slug }));

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCard(decodeURIComponent(slug));
  if (!card) {
    const t = await getTranslations("library.card");
    return { title: t("notFound") };
  }
  return { title: card.view.title, description: card.view.summary };
}

const STAGES = [
  "test",
  "pilot",
  "implemented",
  "implementation",
  "scaled",
] as const;
type Stage = (typeof STAGES)[number];
const isStage = (s: string): s is Stage =>
  (STAGES as readonly string[]).includes(s);

const ORG_TYPES = [
  "fundacja",
  "stowarzyszenie",
  "uczelnia",
  "jst",
  "ops",
  "firma",
  "inna",
] as const;
type OrgType = (typeof ORG_TYPES)[number];
const isOrgType = (s: string): s is OrgType =>
  (ORG_TYPES as readonly string[]).includes(s);

/** Card text: paragraphs on blank lines, „- " / „• " lines as a list. */
function CardText({ text }: { text: string }) {
  const blocks = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul
          key={`l${out.length}`}
          className="marker:text-primary list-disc space-y-1.5 pl-6"
        >
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  let bulletNext = false;
  for (const b of blocks) {
    // Some cards put the list marker on its own line: „-" then the item.
    if (/^[-–•·*]$/u.test(b)) {
      bulletNext = true;
      continue;
    }
    const m = /^[-–•·*]\s*(.+)$/u.exec(b);
    if (m?.[1] ?? bulletNext) list.push(m?.[1] ?? b);
    else {
      flush();
      out.push(<p key={`p${out.length}`}>{b}</p>);
    }
    bulletNext = false;
  }
  flush();
  return <div className="max-w-[68ch] space-y-4">{out}</div>;
}

export default async function InnovationPage({ params }: { params: Params }) {
  const { slug } = await params;
  const card = await getCard(decodeURIComponent(slug));
  if (!card) notFound();
  const [t, tl, locale] = await Promise.all([
    getTranslations("library.card"),
    getTranslations("library.list"),
    getLocale(),
  ]);
  const labels = labelsFor(locale);
  const view = card.view;
  /** Set on content shown in Polish to an English reader (WCAG 3.1.2). */
  const contentLang = locale === "en" && view.lang === "pl" ? "pl" : undefined;

  const sitePowiaty = [
    ...new Set(
      card.sites.map((s) => s.powiatTeryt).filter((x): x is string => !!x),
    ),
  ];
  const isZip = card.materialsUrl?.toLowerCase().endsWith(".zip");
  const materialsLang =
    locale === "en" ? (
      <span className="text-foreground/85 font-normal">
        {" "}
        ({t("materialsLang")})
      </span>
    ) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: tl("title"), href: "/library" }]}
        eyebrow={view.categoryLabels.join(" · ") || t("eyebrowFallback")}
        title={<span lang={contentLang}>{view.title}</span>}
        lead={
          // Only when the summary is shorter than the section it opens.
          (view.sections.solution ?? "").trim().length >
          view.summary.length + 40 ? (
            <p lang={contentLang}>{view.summary}</p>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {card.mapaAreas.map((a) => (
            <AreaTag key={a} area={a} href={`/library?area=${a}`} />
          ))}
          {view.badge ? (
            <span className="border-brand-accent text-brand-accent bg-background inline-flex min-h-11 items-center gap-2 rounded-sm border px-3 text-sm font-bold">
              <AwardIcon aria-hidden="true" className="size-5 shrink-0" />
              <span>
                {t("badge")}
                <span className="sr-only" lang={contentLang}>
                  : {view.badge}
                </span>
              </span>
            </span>
          ) : null}
        </div>
        {locale === "en" ? (
          <p className="text-foreground/85 mt-4 flex max-w-[68ch] items-start gap-2 text-base">
            <LanguagesIcon
              aria-hidden="true"
              className="text-primary mt-1 size-5 shrink-0"
            />
            <span>
              {view.lang === "en"
                ? t("translated")
                : card.enStale
                  ? t("stale")
                  : t("notTranslated")}{" "}
              <a
                href={card.sourceUrl}
                hrefLang="pl"
                className="font-semibold underline decoration-1 underline-offset-4"
              >
                {t("original")}
              </a>
            </span>
          </p>
        ) : null}
      </PageHeader>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        {/* Actions first in reading order; to the right on wide screens. */}
        <aside
          aria-labelledby="actions-heading"
          className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start"
        >
          <div className="border-hairline rounded-lg border p-5">
            <h2 id="actions-heading" className="font-display text-xl font-bold">
              {t("actions")}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <Link
                  href={`/adapt?innovation=${encodeURIComponent(card.slug)}`}
                >
                  {t("adapt")}
                </Link>
              </Button>
              <p className="text-foreground/85 -mt-1 text-[0.9375rem] leading-snug">
                {t("adaptHint")}
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link
                  href={`/test?innovation=${encodeURIComponent(card.slug)}`}
                >
                  {t("test")}
                </Link>
              </Button>
              <ReadAloud
                text={`${labelsFor(view.lang).section.solution} ${view.sections.solution ?? ""}`}
                lang={view.lang}
                className="w-full"
              />
            </div>
            {card.folderUrl || card.materialsUrl ? (
              <div className="border-hairline mt-5 border-t pt-4">
                <h3 className="text-base font-bold">{t("downloads")}</h3>
                <ul className="mt-2 space-y-1">
                  {card.folderUrl ? (
                    <li>
                      <a
                        href={card.folderUrl}
                        hrefLang="pl"
                        className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-1 underline-offset-4"
                      >
                        <FileTextIcon
                          aria-hidden="true"
                          className="text-primary size-5 shrink-0"
                        />
                        <span>
                          {t("folder")}
                          {materialsLang}
                        </span>
                      </a>
                    </li>
                  ) : null}
                  {card.materialsUrl ? (
                    <li>
                      <a
                        href={card.materialsUrl}
                        hrefLang="pl"
                        className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-1 underline-offset-4"
                      >
                        <DownloadIcon
                          aria-hidden="true"
                          className="text-primary size-5 shrink-0"
                        />
                        <span>
                          {isZip ? t("materialsZip") : t("materials")}
                          {materialsLang}
                        </span>
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>

        <article className="min-w-0 lg:col-start-1 lg:row-start-1">
          <EasyText slug={card.slug} title={view.title} className="mb-10" />
          {card.videoUrl ? (
            <section aria-labelledby="video-heading" className="mb-12">
              <h2 id="video-heading" className="sr-only">
                {t("video")}
              </h2>
              <VideoEmbed url={card.videoUrl} title={view.title} />
            </section>
          ) : null}

          {SECTION_KEYS.map((key, i) => {
            const text = view.sections[key]?.trim();
            return (
              <section
                key={key}
                aria-labelledby={`section-${key}`}
                className={i > 0 ? "border-hairline mt-10 border-t pt-8" : ""}
              >
                <h2
                  id={`section-${key}`}
                  className="font-display text-2xl leading-tight font-bold tracking-tight"
                >
                  {labels.section[key]}
                </h2>
                <div className="mt-4" lang={text ? contentLang : undefined}>
                  {text ? (
                    <CardText text={text} />
                  ) : (
                    <p className="text-muted-foreground">{t("missing")}</p>
                  )}
                </div>
              </section>
            );
          })}

          {card.sites.length > 0 ? (
            <section
              aria-labelledby="sites-heading"
              className="border-hairline mt-10 border-t pt-8"
            >
              <h2
                id="sites-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight"
              >
                {t("sites")}
              </h2>
              <ul className="mt-4 space-y-3">
                {card.sites.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <MapPinIcon
                      aria-hidden="true"
                      className="text-primary mt-1 size-5 shrink-0"
                    />
                    <div>
                      <p className="font-semibold">
                        {s.place} {s.isSample ? <SampleBadge /> : null}
                      </p>
                      <p className="text-foreground/85 text-[0.9375rem]">
                        {t("stage", {
                          stage: isStage(s.stage)
                            ? t(`stageLabel.${s.stage}`)
                            : s.stage,
                        })}
                        {s.sourceUrl ? (
                          <>
                            {" · "}
                            <a
                              href={s.sourceUrl}
                              className="underline decoration-1 underline-offset-4"
                            >
                              {t("siteSource")}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {sitePowiaty.length > 0 ? (
                <div className="mt-8">
                  <PowiatMap
                    label={t("mapLabel")}
                    valueLabel={t("mapValue")}
                    values={Object.fromEntries(
                      sitePowiaty.map((p) => [
                        p,
                        card.sites.filter((s) => s.powiatTeryt === p).length,
                      ]),
                    )}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {card.orgs.length > 0 ? (
            <section
              aria-labelledby="orgs-heading"
              className="border-hairline mt-10 border-t pt-8"
            >
              <h2
                id="orgs-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight"
              >
                {t("runBy")}
              </h2>
              <p className="text-foreground/85 mt-2 text-[0.9375rem]">
                {card.orgs.length === 1 ? t("runByLead") : t("runByLeadMany")}
              </p>
              <ul className="mt-4 space-y-3">
                {card.orgs.map((o) => {
                  const details = [
                    isOrgType(o.type) ? t(`orgType.${o.type}`) : null,
                    o.place,
                  ].filter(Boolean);
                  return (
                    <li key={o.id} className="flex gap-3">
                      <Building2Icon
                        aria-hidden="true"
                        className="text-primary mt-1 size-5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {o.name} {o.isSample ? <SampleBadge /> : null}
                        </p>
                        {details.length > 0 ? (
                          <p className="text-foreground/85 text-[0.9375rem]">
                            {details.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4">
                <Link
                  href="/network"
                  className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
                >
                  {t("network")}
                </Link>
              </p>
            </section>
          ) : null}

          <section
            aria-labelledby="licence-heading"
            className="border-hairline mt-10 border-t pt-8"
          >
            <h2 id="licence-heading" className="font-display text-xl font-bold">
              {t("licenceHeading")}
            </h2>
            <p className="mt-3">
              {t("licence")}{" "}
              {card.licence ? (
                card.licenceUrl ? (
                  <ExternalLink
                    href={card.licenceUrl}
                    className="font-semibold"
                  >
                    {card.licence}
                  </ExternalLink>
                ) : (
                  <span className="font-semibold">{card.licence}</span>
                )
              ) : (
                <span className="text-muted-foreground">{t("noLicence")}</span>
              )}
            </p>
            <SourceLine
              className="mt-2"
              source={t("source")}
              href={card.sourceUrl}
              date={card.capturedAt}
            />
          </section>
        </article>
      </div>
    </>
  );
}
