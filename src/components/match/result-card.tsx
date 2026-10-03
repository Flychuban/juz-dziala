"use client";

import Link from "next/link";

import { CALL_STATUS_LABEL, SECTION_LABEL } from "~/lib/domain";
import type { RouterOutputs } from "~/trpc/react";
import { formatDatePl } from "./format";
import { AreaTag, Highlight, ReadAloud, SampleBadge, SourceLine, TwojaSciezka, type PathStep } from "./local-kit";
import { btnSecondary } from "./styles";

export type MatchViewData = RouterOutputs["match"]["get"];
export type ResultCardData = MatchViewData["results"][number];

const NO_DATA = <p className="text-muted-foreground">brak danych w karcie</p>;

function pathSteps(r: ResultCardData): PathStep[] {
  const { sites, helpers, funding } = r.path;
  return [
    { label: "Rozwiązanie", content: <p>{r.card.title}</p> },
    {
      label: "Działa już w",
      content:
        sites.length === 0 ? (
          NO_DATA
        ) : (
          <ul>
            {sites.map((s) => (
              <li key={`${s.place}-${s.stage}`}>
                {s.place}
                {s.isSample && <SampleBadge />}
              </li>
            ))}
          </ul>
        ),
    },
    {
      label: "Kto pomoże",
      content:
        helpers.length === 0 ? (
          <p className="text-muted-foreground">Zespół Hubu ROPS — poproś o pomoc poniżej.</p>
        ) : (
          <ul>
            {helpers.map((h) => (
              <li key={`${h.kind}-${h.name}`}>
                {h.kind === "author" ? "Autorzy rozwiązania: " : h.kind === "mentor" ? "Mentor: " : ""}
                {h.sourceUrl && h.kind !== "author" ? (
                  <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {h.name}
                  </a>
                ) : (
                  h.name
                )}
                {h.detail ? ` — ${h.detail}` : null}
                {h.isSample && <SampleBadge />}
              </li>
            ))}
          </ul>
        ),
    },
    {
      label: "Skąd pieniądze",
      content:
        funding.length === 0 ? (
          <p className="text-muted-foreground">Brak otwartego naboru w naszych danych. Zapytaj ROPS o możliwości.</p>
        ) : (
          <ul>
            {funding.map((f) => (
              <li key={f.id}>
                {f.sourceUrl ? (
                  <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {f.name}
                  </a>
                ) : (
                  f.name
                )}{" "}
                — {CALL_STATUS_LABEL[f.status]}
                {f.windowTo ? `, do ${formatDatePl(f.windowTo)}` : ""}
              </li>
            ))}
          </ul>
        ),
    },
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

export function ResultCard({ r, index, pending }: { r: ResultCardData; index: number; pending: boolean }) {
  const headingId = `result-${r.card.id}`;
  return (
    <article aria-labelledby={headingId} className="border-hairline rounded-lg border p-5 print:break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2">
        {r.verified ? (
          <span className="border-success text-success inline-flex items-center gap-1 rounded-md border-2 px-2 py-0.5 text-sm font-semibold">
            <span aria-hidden="true">✓</span> Sprawdzone przez AI
          </span>
        ) : (
          <span className="border-input text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold">
            {pending ? "Wstępne wyniki" : "Wynik wyszukiwania słów"}
          </span>
        )}
        {r.card.areas.map((a) => (
          <AreaTag key={a} area={a} />
        ))}
      </div>

      <h3 id={headingId} className="mt-3 text-2xl font-bold">
        <span className="sr-only">Rozwiązanie {index + 1}: </span>
        <Link href={`/library/${r.card.slug}`} className="text-foreground underline-offset-4 hover:underline">
          {r.card.title}
        </Link>
      </h3>

      <p className="mt-3 text-lg">
        <Highlight text={r.why} terms={r.userTerms} />
      </p>

      {r.evidence.length > 0 && (
        <figure className="mt-4">
          <blockquote className="border-primary border-l-4 pl-4">
            {r.evidence.map((e) => (
              <p key={e.id} className="mt-1 first:mt-0">
                <span className="text-muted-foreground block text-sm">{SECTION_LABEL[e.section]}</span>
                „{e.text}”
              </p>
            ))}
          </blockquote>
          <figcaption className="mt-2 pl-5">
            <SourceLine
              name={`Biblioteka Innowacji Społecznych ROPS, karta „${r.card.title}”`}
              url={r.card.sourceUrl}
              date={r.card.capturedAt}
            />
          </figcaption>
        </figure>
      )}

      <div className="mt-5">
        <TwojaSciezka steps={pathSteps(r)} />
      </div>

      {r.firstStep ? (
        <p className="mt-4 text-lg">
          <strong>Pierwszy krok:</strong> {r.firstStep}
        </p>
      ) : r.card.whoCanUse ? (
        <p className="mt-4">
          <strong>Kto może skorzystać (z karty):</strong> {r.card.whoCanUse}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2" data-no-print>
        <Link href={`/library/${r.card.slug}`} className={btnSecondary}>
          Szczegóły<span className="sr-only">: {r.card.title}</span>
        </Link>
        <ReadAloud text={readAloudText(r)} className={btnSecondary} />
        {r.card.videoUrl && (
          <a href={r.card.videoUrl} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
            Film<span className="sr-only"> o rozwiązaniu {r.card.title} (otwiera się w nowej karcie)</span>
          </a>
        )}
      </div>
    </article>
  );
}
