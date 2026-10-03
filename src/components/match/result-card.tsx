"use client";

import { CheckIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AreaTag,
  EasyText,
  formatDatePl,
  Highlight,
  ReadAloud,
  SourceLine,
  TwojaSciezka,
  VideoEmbed,
  type PathStep,
} from "~/components/kit";
import { CALL_STATUS_LABEL, SECTION_LABEL } from "~/lib/domain";
import type { RouterOutputs } from "~/trpc/react";
import { shortCallName } from "./format";
import { btnPrimary, btnSecondary } from "./styles";

export type MatchViewData = RouterOutputs["match"]["get"];
export type ResultCardData = MatchViewData["results"][number];
type Funding = NonNullable<ResultCardData["path"]["funding"]>;

function windowText(f: Funding): string {
  const from = formatDatePl(f.windowFrom);
  const to = formatDatePl(f.windowTo);
  if (from && to) return `${from} – ${to}`;
  return to ? `do ${to}` : "";
}

function fundingStep(f: Funding | null): PathStep {
  if (!f) {
    return {
      label: "Skąd pieniądze",
      title: "Zapytaj w ośrodku pomocy społecznej w swojej gminie",
      detail: "W naszych danych nie ma teraz otwartego naboru na to rozwiązanie.",
    };
  }
  const status = CALL_STATUS_LABEL[f.status].toLowerCase();
  const when = windowText(f);
  if (f.reason === "listed") {
    if (f.status === "closed") {
      return {
        label: "Skąd pieniądze",
        title: "Program ROPS «Usługa Wrażliwa» (nabór zakończony — kolejne nabory: zapytaj ROPS)",
        detail: "To rozwiązanie jest na liście innowacji do wdrożenia w tym programie.",
        href: f.sourceUrl,
        linkLabel: "Zobacz ostatni nabór",
      };
    }
    return {
      label: "Skąd pieniądze",
      title: "Program ROPS «Usługa Wrażliwa»",
      detail: `To rozwiązanie jest na liście innowacji do wdrożenia. Nabór: ${status}${when ? `, ${when}` : ""}.`,
      href: f.sourceUrl,
      linkLabel: "Zobacz nabór",
    };
  }
  return {
    label: "Skąd pieniądze",
    title: shortCallName(f.name),
    detail: `Nabór na innowacje społeczne: ${status}${when ? `, ${when}` : ""}.${f.status === "demo" ? " Dane przykładowe." : ""}`,
    href: f.sourceUrl,
    linkLabel: "Zobacz nabór",
  };
}

function pathSteps(r: ResultCardData): PathStep[] {
  const { sites, helpers, funding } = r.path;
  const helper = helpers[0];
  return [
    {
      label: "Rozwiązanie",
      title: r.card.title,
      detail: r.card.categoryLabels[0] ?? null,
      href: `/library/${r.card.slug}`,
      linkLabel: "Zobacz kartę",
    },
    sites.length > 0
      ? {
          label: "Działa już w",
          title: sites.map((s) => s.place).join(", "),
          detail: sites.some((s) => s.isSample) ? "Dane przykładowe." : null,
        }
      : {
          label: "Działa już w",
          title: "Brak informacji",
          detail: "W karcie brak informacji o wdrożeniach — zapytaj ROPS.",
        },
    helper
      ? {
          label: "Kto pomoże",
          title: helper.name,
          detail:
            helper.kind === "org"
              ? `${helper.detail && helper.detail !== "inna" ? `${helper.detail} · ` : ""}autorzy rozwiązania`
              : helper.kind === "mentor"
                ? `${helper.detail ?? "Mentor"}${helper.isSample ? " · dane przykładowe" : ""}`
                : "Autorzy rozwiązania (z karty).",
          href: helper.kind === "mentor" ? "/network" : null,
          linkLabel: "Sieć mentorów",
        }
      : { label: "Kto pomoże", title: "Zespół Hubu ROPS", detail: "Poproś o pomoc poniżej." },
    fundingStep(funding),
  ];
}

function readAloudText(r: ResultCardData): string {
  return [
    r.card.title,
    r.why,
    ...r.evidence.map((e) => `Z karty: ${e.text}`),
    r.firstStep ? `Pierwszy krok: ${r.firstStep}` : r.card.whoCanUse ? `Kto może skorzystać: ${r.card.whoCanUse}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

function Quote({ e }: { e: ResultCardData["evidence"][number] }) {
  return (
    <p className="mt-2 first:mt-0">
      <span className="text-muted-foreground block text-sm font-semibold">{SECTION_LABEL[e.section]}</span>„{e.text}”
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
  const headingId = `result-${r.card.id}`;
  const [showVideo, setShowVideo] = useState(false);
  return (
    <article
      aria-labelledby={headingId}
      className="border-hairline bg-background rounded-lg border p-5 max-[22rem]:px-3 sm:p-7 print:break-inside-avoid"
    >
      <div className="flex flex-wrap items-center gap-2">
        {r.verified ? (
          <span className="border-success text-success inline-flex items-center gap-1 rounded-sm border-2 px-2 py-0.5 text-sm font-bold">
            <CheckIcon aria-hidden="true" className="size-4" /> Sprawdzone przez AI
          </span>
        ) : (
          <span className="border-input text-muted-foreground inline-flex items-center rounded-sm border px-2 py-0.5 text-sm font-semibold">
            {pending ? "Wstępne wyniki" : "Wynik wyszukiwania słów"}
          </span>
        )}
        {r.card.areas.map((a) => (
          <AreaTag key={a} area={a} />
        ))}
      </div>

      <h2 id={headingId} className="mt-3 text-2xl font-bold sm:text-[1.75rem]">
        <span className="sr-only">Rozwiązanie {index + 1}: </span>
        <Link href={`/library/${r.card.slug}`} className="text-foreground underline-offset-4 hover:underline">
          {r.card.title}
        </Link>
      </h2>

      <p className="mt-3 text-lg leading-relaxed">
        <Highlight text={r.why} terms={r.userTerms} />
      </p>

      {r.evidence.length > 0 && (
        <figure className="mt-5">
          <blockquote className="border-primary border-l-4 pl-4">
            <Quote e={r.evidence[0]!} />
          </blockquote>
          <figcaption className="mt-2 pl-5">
            <SourceLine
              source={`Biblioteka Innowacji Społecznych ROPS, karta „${r.card.title}”`}
              href={r.card.sourceUrl}
              date={r.card.capturedAt}
            />
          </figcaption>
          {r.evidence.length > 1 && (
            <details className="group mt-3 pl-5">
              <summary className="text-foreground inline-flex min-h-12 cursor-pointer items-center font-semibold underline underline-offset-4">
                Pokaż więcej cytatów z karty ({r.evidence.length - 1})
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

      <TwojaSciezka steps={pathSteps(r)} headingLevel="h3" className="mt-6" />

      {r.firstStep ? (
        <p className="mt-5 text-lg">
          <strong>Pierwszy krok:</strong> {r.firstStep}
        </p>
      ) : r.card.whoCanUse ? (
        <p className="mt-5">
          <strong>Kto może skorzystać (z karty):</strong> {r.card.whoCanUse}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2" data-no-print>
        <button type="button" className={btnPrimary} onClick={onRequestHelp}>
          Poproś ROPS o pomoc<span className="sr-only"> w sprawie: {r.card.title}</span>
        </button>
        <Link href={`/library/${r.card.slug}`} className={btnSecondary}>
          Szczegóły<span className="sr-only">: {r.card.title}</span>
        </Link>
        <ReadAloud text={readAloudText(r)} className="h-auto min-h-12 shrink px-4 text-base whitespace-normal" />
        {r.card.videoUrl && (
          <button
            type="button"
            className={btnSecondary}
            aria-expanded={showVideo}
            onClick={() => setShowVideo((v) => !v)}
          >
            <PlayIcon aria-hidden="true" className="size-4" />
            {showVideo ? "Ukryj film" : "Film"}
          </button>
        )}
      </div>
      {r.card.videoUrl && showVideo && <VideoEmbed url={r.card.videoUrl} title={r.card.title} className="mt-4" />}
      <EasyText slug={r.card.slug} title={r.card.title} context="result" className="mt-4" />
    </article>
  );
}
