"use client";

import { CheckIcon, PlayIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import {
  AreaTag,
  EasyText,
  formatDate,
  Highlight,
  ReadAloud,
  SourceLine,
  TwojaSciezka,
  VideoEmbed,
  type PathStep,
} from "~/components/kit";
import { useLabels } from "~/i18n/use-labels";
import type { RouterOutputs } from "~/trpc/react";
import { btnPrimary, btnSecondary } from "./styles";

export type MatchViewData = RouterOutputs["match"]["get"];
export type ResultCardData = MatchViewData["results"][number];
type Funding = NonNullable<MatchViewData["funding"]>;
type Evidence = ResultCardData["evidence"][number];

/** The id of the one „Skąd wziąć pieniądze na wdrożenie" block under all results. */
export const FUNDING_ID = "funding";

const ORG_TYPES = ["fundacja", "stowarzyszenie", "uczelnia", "jst", "ops", "firma", "inna"] as const;
type OrgType = (typeof ORG_TYPES)[number];
const isOrgType = (v: string | null): v is OrgType => v !== null && (ORG_TYPES as readonly string[]).includes(v);

/** „, 22 grudnia 2025 – 20 lutego 2026" / ", until 20 February 2026" — or nothing. */
export function useCallWindow() {
  const t = useTranslations("match.funding");
  const locale = useLocale();
  return (f: Pick<Funding, "windowFrom" | "windowTo">): string => {
    const from = formatDate(f.windowFrom, locale);
    const to = formatDate(f.windowTo, locale);
    if (from && to) return t("window", { from, to });
    return to ? t("windowTo", { to }) : "";
  };
}

/**
 * Rozwiązanie → Kto to prowadzi (only when known) → Kto pomoże (a mentor for
 * the card's area, else the ROPS Hub team) → Skąd pieniądze (the programme
 * only when it lists this card; otherwise the one funding block below).
 */
function usePathSteps(r: ResultCardData): PathStep[] {
  const t = useTranslations("match");
  const labels = useLabels();
  const locale = useLocale();
  const callWindow = useCallWindow();
  const { runBy, mentor, funding } = r.path;
  const steps: PathStep[] = [
    {
      label: t("path.solution"),
      title: r.card.title,
      detail: r.card.categoryLabels[0] ?? null,
      href: `/library/${r.card.slug}`,
      linkLabel: t("path.seeCard"),
    },
  ];

  const first = runBy[0];
  if (first) {
    const place = runBy.find((o) => o.place)?.place ?? null;
    const detail = [
      first.fromCard ? t("path.runByAuthors") : isOrgType(first.type) ? t(`orgType.${first.type}`) : null,
      place ? t("path.runsIn", { place }) : null,
      runBy.some((o) => o.isSample) ? t("path.sample") : null,
    ].filter(Boolean);
    steps.push({ label: t("path.runBy"), title: runBy.map((o) => o.name).join(", "), detail: detail.join(" ") || null });
  }

  if (mentor) {
    const role = t(`path.mentorRole.${mentor.role}`);
    const areas = mentor.areas.map((a) => labels.area[a]).join(", ");
    const detail = locale === "pl" && mentor.title ? mentor.title : t("path.mentorDetail", { role, areas });
    steps.push({
      label: t("path.helps"),
      title: mentor.name,
      detail: mentor.isSample ? `${detail}. ${t("path.sample")}` : detail,
      href: "/network#mentorzy",
      linkLabel: t("path.mentorLink"),
    });
  } else {
    steps.push({ label: t("path.helps"), title: t("path.hubTeam"), detail: t("path.hubDetail") });
  }

  if (funding?.reason === "listed") {
    const closed = funding.status === "closed";
    steps.push({
      label: t("path.money"),
      title: closed ? t("path.listedClosedTitle") : t("path.listedTitle"),
      detail: closed
        ? t("path.listedClosedDetail")
        : t("path.listedDetail", { status: labels.callStatus[funding.status].toLowerCase(), window: callWindow(funding) }),
      href: funding.sourceUrl,
      linkLabel: closed ? t("path.listedClosedLink") : t("path.listedLink"),
    });
  } else {
    steps.push({
      label: t("path.money"),
      title: t("path.seeBelow"),
      detail: t("path.seeBelowDetail"),
      href: `#${FUNDING_ID}`,
      linkLabel: t("path.seeBelowLink"),
    });
  }
  return steps;
}

/** One quoted card sentence. On the English page: the translation, labelled, with the Polish original one click away. */
function Quote({ e }: { e: Evidence }) {
  const t = useTranslations("match.card");
  const labels = useLabels();
  const locale = useLocale();
  const section = <span className="text-muted-foreground block text-sm font-semibold">{labels.section[e.section]}</span>;
  if (e.translation) {
    return (
      <div className="mt-3 first:mt-0">
        {section}
        <p>“{e.translation}”</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("translated")}</p>
        <details className="mt-1">
          <summary className="text-foreground inline-flex min-h-12 cursor-pointer items-center text-sm font-semibold underline underline-offset-4">
            {t("original")}
          </summary>
          <p lang="pl" className="text-foreground/85">
            „{e.text}”
          </p>
        </details>
      </div>
    );
  }
  return (
    <p className="mt-3 first:mt-0">
      {section}
      <span lang={locale === "pl" ? undefined : "pl"}>„{e.text}”</span>
    </p>
  );
}

export function ResultCard({
  r,
  index,
  pending,
  onRequestHelp,
}: {
  r: ResultCardData;
  index: number;
  pending: boolean;
  onRequestHelp: () => void;
}) {
  const t = useTranslations("match.card");
  const tp = useTranslations("match.path");
  const locale = useLocale();
  const steps = usePathSteps(r);
  const headingId = `result-${r.card.id}`;
  const [showVideo, setShowVideo] = useState(false);
  /** lang attribute for text in a language other than the page's (WCAG 3.1.2). */
  const langOf = (l: string) => (l !== locale ? l : undefined);
  const firstQuote = r.evidence[0];
  const readAloud = [
    r.card.title,
    r.why,
    ...r.evidence.map((e) => t("read.fromCard", { text: e.translation ?? e.text })),
    r.firstStep
      ? t("read.firstStep", { text: r.firstStep })
      : r.card.whoCanUse
        ? t("read.whoCanUse", { text: r.card.whoCanUse })
        : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <article
      aria-labelledby={headingId}
      className="border-hairline bg-background rounded-lg border p-5 max-[22rem]:px-3 sm:p-7 print:break-inside-avoid"
    >
      <div className="flex flex-wrap items-center gap-2">
        {r.verified ? (
          <span className="border-success text-success inline-flex items-center gap-1 rounded-sm border-2 px-2 py-0.5 text-sm font-bold">
            <CheckIcon aria-hidden="true" className="size-4" /> {t("verified")}
          </span>
        ) : (
          <span className="border-input text-muted-foreground inline-flex items-center rounded-sm border px-2 py-0.5 text-sm font-semibold">
            {pending ? t("preliminary") : t("keyword")}
          </span>
        )}
        {r.card.areas.map((a) => (
          <AreaTag key={a} area={a} />
        ))}
      </div>

      <h2 id={headingId} className="mt-3 text-2xl font-bold sm:text-[1.75rem]">
        <span className="sr-only">{t("srIndex", { n: index + 1 })}</span>
        <Link
          href={`/library/${r.card.slug}`}
          lang={langOf(r.card.lang)}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {r.card.title}
        </Link>
      </h2>

      <p className="mt-3 text-lg leading-relaxed" lang={langOf(r.whyLang)}>
        <Highlight text={r.why} terms={r.userTerms} />
      </p>

      {firstQuote && (
        <figure className="mt-5">
          <blockquote className="border-primary border-l-4 pl-4">
            <Quote e={firstQuote} />
          </blockquote>
          <figcaption className="mt-2 pl-5">
            <SourceLine source={t("source", { title: r.card.title })} href={r.card.sourceUrl} date={r.card.capturedAt} />
          </figcaption>
          {r.evidence.length > 1 && (
            <details className="group mt-3 pl-5">
              <summary className="text-foreground inline-flex min-h-12 cursor-pointer items-center font-semibold underline underline-offset-4">
                {t("moreQuotes", { count: r.evidence.length - 1 })}
              </summary>
              <blockquote className="border-primary mt-2 border-l-4 pl-4">
                {r.evidence.slice(1).map((e) => (
                  <Quote key={e.id} e={e} />
                ))}
              </blockquote>
            </details>
          )}
        </figure>
      )}

      {/* The path belongs to the card: a hairline above it, not a second box inside the box. */}
      <TwojaSciezka
        steps={steps}
        heading={tp("heading")}
        headingLevel="h3"
        className="mt-6 rounded-none border-x-0 border-t border-b-0 px-0 pt-5 pb-0 sm:px-0 sm:pt-5 sm:pb-0 md:px-0 md:pt-6 md:pb-0"
      />

      {r.firstStep ? (
        <p className="mt-5 text-lg">
          <strong>{t("firstStep")}</strong> <span lang={langOf(r.whyLang)}>{r.firstStep}</span>
        </p>
      ) : r.card.whoCanUse ? (
        <p className="mt-5">
          <strong>{t("whoCanUse")}</strong> <span lang={langOf(r.card.lang)}>{r.card.whoCanUse}</span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-col items-start gap-3" data-no-print>
        <button type="button" className={btnPrimary} onClick={onRequestHelp}>
          {t("askHelp")}
          <span className="sr-only">{t("askHelpSr", { title: r.card.title })}</span>
        </button>
        <div
          role="group"
          aria-label={t("actions", { title: r.card.title })}
          className="flex w-full flex-wrap gap-2 [&_[data-slot=easy-text]>div]:basis-full [&_[data-slot=easy-text]>div:empty]:hidden"
        >
          <Link href={`/library/${r.card.slug}`} className={btnSecondary}>
            {t("details")}
            <span className="sr-only">{t("titleSr", { title: r.card.title })}</span>
          </Link>
          <ReadAloud text={readAloud} className="h-auto min-h-12 shrink px-4 text-base whitespace-normal" />
          {r.card.videoUrl && (
            <button type="button" className={btnSecondary} aria-expanded={showVideo} onClick={() => setShowVideo((v) => !v)}>
              <PlayIcon aria-hidden="true" className="size-4" />
              {showVideo ? t("hideVideo") : t("video")}
            </button>
          )}
          <EasyText slug={r.card.slug} title={r.card.title} context="result" className="contents" />
        </div>
        {r.card.videoUrl && showVideo && <VideoEmbed url={r.card.videoUrl} title={r.card.title} className="w-full" />}
      </div>
    </article>
  );
}
