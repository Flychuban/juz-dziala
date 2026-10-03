"use client";

import {
  ArrowRightIcon,
  FileTextIcon,
  LayoutGridIcon,
  PrinterIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";

import { PlanMarkdown } from "~/components/adapt/plan-markdown";
import { Highlight, SourceLine, UserTerms } from "~/components/kit";
import { Button } from "~/components/ui/button";
import {
  IDEA_STAGE_LABEL,
  MAPA_AREA_LABEL,
  SECTION_LABEL,
  type CaseKind,
} from "~/lib/domain";
import type { CasePayloads } from "~/server/cases/payloads";
import type { MatchContext } from "~/server/cases/match-context";
import { RATING_LABEL } from "~/server/ideas/schema";
import { fmtDate } from "./format";

/**
 * Module payloads inside a case, shared by the author page and the staff
 * workspace: the Ramowy Plan Wdrożenia (adapt), the idea's fiszka and IWS
 * self-score (+ Canvas and application for staff), the innovation a test or
 * opinion is about, and — staff only — what the resident was shown by the
 * matcher, with their own words and the card quotes.
 */

const box = "border-hairline rounded-lg border p-4";

const withToken = (path: string, token?: string) =>
  token ? `${path}?t=${encodeURIComponent(token)}` : path;

export function PlanSection({
  plan,
  code,
  defaultOpen = false,
}: {
  plan: NonNullable<CasePayloads["plan"]>;
  code: string;
  defaultOpen?: boolean;
}) {
  return (
    <section aria-labelledby="plan-heading" className={box}>
      <h2 id="plan-heading" className="text-xl font-bold">
        Ramowy Plan Wdrożenia
      </h2>
      <dl className="mt-3 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        {plan.details.map((d) => (
          <div key={d.label} className="contents">
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className="break-words">{d.value}</dd>
          </div>
        ))}
        {plan.modeLabel && (
          <>
            <dt className="text-muted-foreground">Plan przygotowano</dt>
            <dd>{plan.modeLabel}</dd>
          </>
        )}
        {plan.submittedAt && (
          <>
            <dt className="text-muted-foreground">Wysłano do ROPS</dt>
            <dd>{fmtDate(plan.submittedAt)}</dd>
          </>
        )}
      </dl>
      {plan.ramowyPlan && (
        <p className="mt-3">
          ROPS ma już Ramowy Plan Wdrożenia tej innowacji z naboru „
          {plan.ramowyPlan.callName}”.
          {plan.ramowyPlan.sourceUrl && (
            <>
              {" "}
              <a
                href={plan.ramowyPlan.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ogłoszenie naboru
                <span className="sr-only"> (otwiera się w nowej karcie)</span>
              </a>
            </>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3" data-no-print>
        <Button asChild variant="outline" className="min-h-12 px-4 text-base">
          <Link href={`/case/${code}/plan`}>
            <PrinterIcon aria-hidden="true" />
            Drukuj plan
          </Link>
        </Button>
      </div>
      <details className="mt-4" open={defaultOpen}>
        <summary className="min-h-12 cursor-pointer py-2 font-semibold underline">
          Pokaż cały plan
        </summary>
        <PlanMarkdown markdown={plan.markdown} className="mt-2" />
      </details>
    </section>
  );
}

export function IdeaSection({
  idea,
  call,
  code,
  viewer,
  token,
}: {
  idea: NonNullable<CasePayloads["idea"]>;
  call: CasePayloads["call"];
  code: string;
  viewer: "author" | "staff";
  token?: string;
}) {
  const s = idea.selfScore;
  return (
    <section aria-labelledby="idea-heading" className={box}>
      <h2 id="idea-heading" className="text-xl font-bold">
        Fiszka pomysłu
      </h2>
      <dl className="mt-3 flex flex-col gap-3">
        <div>
          <dt className="text-muted-foreground font-semibold">Nazwa</dt>
          <dd className="break-words">{idea.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">
            Na czym polega?
          </dt>
          <dd className="break-words whitespace-pre-wrap">
            {idea.description}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">Komu pomaga?</dt>
          <dd className="break-words whitespace-pre-wrap">
            {idea.targetGroup || "nie podano"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">
            Na jakim etapie?
          </dt>
          <dd>{idea.stage ? IDEA_STAGE_LABEL[idea.stage] : "nie podano"}</dd>
        </div>
        {idea.areas.length > 0 && (
          <div>
            <dt className="text-muted-foreground font-semibold">Obszar</dt>
            <dd>{idea.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")}</dd>
          </div>
        )}
      </dl>

      {s && s.items.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold">
            Samoocena według kryteriów naboru (IWS)
          </h3>
          <p className="text-muted-foreground text-sm">
            Wstępna ocena przygotowana w Kreatorze pomysłów — nie jest oceną
            komisji.
          </p>
          <div className="border-hairline mt-2 overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <caption className="sr-only">
                Samoocena pomysłu: punkty za każde kryterium
              </caption>
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Kryterium
                  </th>
                  <th scope="col" className="px-3 py-2 tabular-nums">
                    Punkty
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Dlaczego
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Co poprawić
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((it) => {
                  const below = it.minToPass != null && it.score < it.minToPass;
                  return (
                    <tr
                      key={it.key}
                      className="border-hairline border-t align-top"
                    >
                      <th scope="row" className="px-3 py-2 font-semibold">
                        {it.label}
                      </th>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {it.score} / {it.max}
                        {it.minToPass != null && (
                          <span className="block text-sm">
                            min. {it.minToPass}
                            {below && (
                              <span className="text-destructive font-semibold">
                                {" "}
                                — poniżej
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{it.reason}</td>
                      <td className="px-3 py-2">{it.improve}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-hairline border-t font-semibold">
                  <th scope="row" className="px-3 py-2">
                    Razem
                  </th>
                  <td className="px-3 py-2 tabular-nums" colSpan={3}>
                    {s.total} / {s.max}
                    {s.minScore != null && ` (minimum naboru: ${s.minScore})`}
                    {" — "}
                    {s.meetsMinimum
                      ? "spełnia minimum"
                      : "nie spełnia jeszcze minimum"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {idea.similar.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold">Podobne rozwiązania w Bibliotece</h3>
          <ul className="mt-1 list-disc pl-6">
            {idea.similar.map((x) => (
              <li key={x.innovationId}>
                <Link href={`/library/${x.slug}`}>{x.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(idea.application ?? call) && (
        <p className="mt-5">
          <span className="font-semibold">Wniosek złożony w naborze:</span>{" "}
          {idea.application?.callName ?? call?.name}
          {idea.application && ` (${fmtDate(idea.application.submittedAt)})`}
        </p>
      )}

      {viewer === "author" ? (
        <div className="mt-5 flex flex-wrap gap-3" data-no-print>
          <Button asChild variant="outline" className="min-h-12 px-4 text-base">
            <Link href={withToken(`/ideas/${code}/canvas`, token)}>
              <LayoutGridIcon aria-hidden="true" />
              {idea.hasCanvas ? "Twój Canvas" : "Rozpisz pomysł na Canvasie"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 px-4 text-base">
            <Link href={withToken(`/ideas/${code}/application`, token)}>
              <FileTextIcon aria-hidden="true" />
              {idea.application ? "Twój wniosek" : "Przygotuj wniosek"}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {idea.canvas && idea.canvas.length > 0 && (
            <details className="mt-5">
              <summary className="min-h-12 cursor-pointer py-2 font-semibold underline">
                Canvas pomysłu (podgląd, tylko do odczytu)
              </summary>
              <dl className="mt-2 flex flex-col gap-3">
                {idea.canvas.map((c) => (
                  <div key={`${c.sheet}-${c.section}`}>
                    <dt className="font-semibold">
                      {c.section}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {c.sheet}
                      </span>
                    </dt>
                    {c.lines.map((l, i) => (
                      <dd key={i} className="break-words whitespace-pre-wrap">
                        {l}
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
            </details>
          )}
          {!idea.hasCanvas && (
            <p className="text-muted-foreground mt-5 text-sm">
              Autor nie wypełnił jeszcze Canvasu.
            </p>
          )}
          {idea.application?.fields && idea.application.fields.length > 0 && (
            <details className="mt-3">
              <summary className="min-h-12 cursor-pointer py-2 font-semibold underline">
                Złożony wniosek (podgląd, tylko do odczytu)
              </summary>
              <dl className="mt-2 flex flex-col gap-3">
                {idea.application.fields.map((f) => (
                  <div key={f.key}>
                    <dt className="font-semibold">{f.label}</dt>
                    <dd className="break-words whitespace-pre-wrap">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export function InnovationSection({
  kind,
  innovation,
  rating,
}: {
  kind: CaseKind;
  innovation: NonNullable<CasePayloads["innovation"]>;
  rating: number | null;
}) {
  return (
    <section aria-labelledby="innovation-heading" className={box}>
      <h2 id="innovation-heading" className="text-xl font-bold">
        {kind === "test"
          ? "Zgłoszenie do testowania"
          : kind === "feedback"
            ? "Opinia o innowacji"
            : kind === "adapt"
              ? "Innowacja do wdrożenia"
              : "Dotyczy innowacji"}
      </h2>
      <p className="mt-2 text-lg font-semibold">
        <Link href={`/library/${innovation.slug}`}>{innovation.title}</Link>
      </p>
      <SourceLine
        source="Biblioteka Innowacji Społecznych ROPS Kraków"
        href={innovation.sourceUrl}
        date={innovation.capturedAt}
      />
      {rating != null && (
        <p className="mt-3">
          <span className="font-semibold">Ocena:</span>{" "}
          <span className="tabular-nums">{rating} / 5</span>
          {rating in RATING_LABEL &&
            ` — ${RATING_LABEL[rating as keyof typeof RATING_LABEL]}`}
        </p>
      )}
    </section>
  );
}

const STAGE_TEXT: Record<MatchContext["stage"], string> = {
  verified: "Sprawdzone przez AI",
  keyword: "Wyniki z dopasowania słów kluczowych",
  preliminary: "Wstępne wyniki (AI jeszcze sprawdzało)",
  abstained: "Nie mamy pewnego dopasowania",
};

/** Staff: what the resident saw before asking for help. */
export function MatchSection({ match }: { match: MatchContext }) {
  return (
    <section aria-labelledby="match-heading" className={box}>
      <h2 id="match-heading" className="text-xl font-bold">
        Co autor zobaczył w wynikach
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Wyszukiwanie z {fmtDate(match.createdAt)} · {STAGE_TEXT[match.stage]}
      </p>
      <blockquote className="border-hairline mt-3 border-l-4 pl-3">
        <Highlight text={match.query} terms={match.userTerms} />
      </blockquote>
      {match.crisis && (
        <p className="text-destructive mt-2 font-bold">
          Wyszukiwanie wykryło sygnały kryzysu — autor zobaczył telefony
          wsparcia.
        </p>
      )}
      {match.results.length === 0 ? (
        <p className="mt-3">
          Autor nie dostał gotowych rozwiązań i poprosił o pomoc człowieka.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-5">
          {match.results.map((r, i) => (
            <li key={r.cardId} className="flex flex-col gap-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground tabular-nums">
                  {i + 1}.
                </span>
                <Link
                  href={`/library/${r.slug}`}
                  className="text-lg font-semibold"
                >
                  {r.title}
                </Link>
                {r.verified ? (
                  <span className="border-success text-success inline-flex items-center gap-1 rounded-sm border px-1.5 text-sm font-semibold">
                    <ShieldCheckIcon aria-hidden="true" className="size-3.5" />
                    Sprawdzone przez AI
                  </span>
                ) : (
                  <span className="border-input rounded-sm border border-dashed px-1.5 text-sm font-semibold">
                    Wstępne wyniki
                  </span>
                )}
              </p>
              <p>{r.why}</p>
              <UserTerms terms={r.userTerms} label="Słowa autora" />
              {r.evidence.map((e) => (
                <blockquote
                  key={e.id}
                  className="border-primary bg-surface border-l-4 px-3 py-2"
                >
                  <Highlight text={e.text} terms={r.userTerms} />
                  <footer className="text-muted-foreground mt-1 text-sm">
                    Karta: {SECTION_LABEL[e.section]}
                  </footer>
                </blockquote>
              ))}
              {r.firstStep && (
                <p>
                  <span className="font-semibold">Pierwszy krok:</span>{" "}
                  {r.firstStep}
                </p>
              )}
              <SourceLine
                source="Biblioteka Innowacji Społecznych ROPS Kraków"
                href={r.sourceUrl}
                date={r.capturedAt}
              />
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4">
        <Link
          href={`/match/${match.id}`}
          className="inline-flex min-h-12 items-center gap-1"
        >
          Otwórz wyniki tak, jak widział je autor
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </p>
    </section>
  );
}
