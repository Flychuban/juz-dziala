"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { pluralPl as plural, SourceLine, UserTerms } from "~/components/kit";
import { MAPA_AREA_LABEL } from "~/lib/domain";
import { api } from "~/trpc/react";
import { CrisisBanner } from "./crisis-banner";
import { knowledgeDetail } from "./format";
import { RequestHelp } from "./request-help";
import { ResultCard, type MatchViewData } from "./result-card";
import { btnSecondary } from "./styles";

const PROGRESS = [
  { after: 0, text: (n: number) => `Sprawdzamy ${n} kart innowacji ROPS…` },
  { after: 2500, text: () => "Porównujemy z Twoim opisem…" },
  { after: 7000, text: () => "Sprawdzamy cytaty w kartach…" },
  { after: 16000, text: () => "To trwa dłużej niż zwykle. Wstępne wyniki już widzisz." },
];

function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(t);
  }, [active]);
  return elapsed;
}

const NOTE_TEXT: Record<NonNullable<MatchViewData["note"]>, string> = {
  ai_unavailable: "Sprawdzanie przez AI jest teraz wyłączone. Pokazujemy wyniki wyszukiwania słów z Twojego opisu.",
  ai_error: "Nie udało się sprawdzić wyników przez AI. Pokazujemy wyniki wyszukiwania słów z Twojego opisu.",
  ai_no_better: "AI nie znalazło pewniejszych dopasowań. Pokazujemy wyniki wyszukiwania słów z Twojego opisu.",
};

export function MatchResults({ runId, initial }: { runId: string; initial: MatchViewData }) {
  const utils = api.useUtils();
  const query = api.match.get.useQuery({ runId }, { initialData: initial, staleTime: Infinity });
  const view = query.data;
  const refine = api.match.refine.useMutation({
    onSuccess: (v) => utils.match.get.setData({ runId }, v),
  });
  const asked = useRef(false);
  const h1 = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h1.current?.focus();
  }, []);

  useEffect(() => {
    if (view.stage === "preliminary" && !asked.current) {
      asked.current = true;
      refine.mutate({ runId });
    }
  }, [view.stage, runId, refine]);

  const pending = view.stage === "preliminary" && !refine.isError;
  const elapsed = useElapsed(pending);
  const progress = [...PROGRESS].reverse().find((p) => elapsed >= p.after) ?? PROGRESS[0]!;

  const failed = view.stage === "preliminary" && refine.isError;
  const abstained = view.stage === "abstained" || (failed && view.results.length === 0);

  let liveText = "";
  if (pending) liveText = progress.text(view.libraryCount);
  else if (view.stage === "verified")
    liveText = `Gotowe. ${view.results.length} ${plural(view.results.length, "rozwiązanie sprawdzone", "rozwiązania sprawdzone", "rozwiązań sprawdzonych")} przez AI.`;
  else if (abstained) liveText = "Nie mamy pewnego dopasowania.";
  else if (failed) liveText = "Nie udało się sprawdzić wyników przez AI. Pokazujemy wyniki wyszukiwania.";

  const topArea = view.areas[0];

  return (
    <div className="flex flex-col gap-8">
      {view.crisis.urgent && <CrisisBanner />}

      <header className="flex flex-col gap-3">
        <h1 ref={h1} tabIndex={-1} className="text-4xl font-bold outline-none">
          Gotowe rozwiązania dla Ciebie
        </h1>
        {view.userTerms.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-lg font-semibold">Twoje słowa:</span>
            <UserTerms terms={view.userTerms} />
          </div>
        )}
        {view.place && (
          <p className="text-muted-foreground">
            Gmina: {view.place.gminaName ?? view.place.gminaTeryt}
            {view.place.gminaKind ? ` (gmina ${view.place.gminaKind})` : ""}
            {view.place.powiatName ? `, ${view.place.powiatName}` : ""}
          </p>
        )}
        <p className="text-muted-foreground">
          Szukaliśmy w {view.libraryCount} kartach Biblioteki Innowacji Społecznych ROPS.{" "}
          <Link href="/" className="text-foreground underline" data-no-print>
            Zmień opis
          </Link>
        </p>
      </header>

      <p role="status" aria-live="polite" className={pending ? "border-hairline bg-surface rounded-lg border p-4 text-lg" : "sr-only"}>
        {pending && (
          <span aria-hidden="true" className="border-primary mr-3 inline-block size-4 animate-spin rounded-full border-2 border-t-transparent align-middle" />
        )}
        {liveText}
      </p>

      {abstained ? (
        <section aria-labelledby="abstain-heading" className="border-foreground rounded-lg border-2 p-5">
          <h2 id="abstain-heading" className="text-2xl font-bold">
            Nie mamy pewnego dopasowania
          </h2>
          <p className="mt-2 max-w-prose text-lg">
            Nie mamy pewnego dopasowania w Bibliotece ROPS. Przekażemy Twoje zgłoszenie ekspertowi.
          </p>
          <p className="text-muted-foreground mt-2 max-w-prose">
            Wolimy to niż podsunąć rozwiązanie, które do Ciebie nie pasuje. Możesz też{" "}
            <Link href="/" className="text-foreground underline">
              opisać sprawę inaczej
            </Link>{" "}
            albo{" "}
            <Link href="/library" className="text-foreground underline">
              przejrzeć Bibliotekę
            </Link>
            .
          </p>
        </section>
      ) : (
        <section aria-label="Wyniki" className="flex flex-col gap-5">
          {(view.note ?? (failed ? "ai_error" : null)) && (
            <p className="border-hairline bg-surface rounded-lg border p-3">{NOTE_TEXT[view.note ?? "ai_error"]}</p>
          )}
          {view.results.map((r, i) => (
            <ResultCard key={r.card.id} r={r} index={i} pending={pending} />
          ))}
        </section>
      )}

      {(view.knowledge ?? view.similar) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {view.knowledge && (
            <section aria-labelledby="fact-heading" className="border-hairline rounded-lg border p-5">
              <h2 id="fact-heading" className="text-xl font-bold">
                Warto wiedzieć
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">{view.knowledge.areaLabel}</p>
              <p className="mt-2 text-lg">{view.knowledge.text}</p>
              <div className="mt-2">
                <SourceLine
                  source={view.knowledge.sourceTitle}
                  href={view.knowledge.sourceUrl}
                  detail={knowledgeDetail(view.knowledge.page, view.knowledge.sourceDate)}
                />
              </div>
            </section>
          )}
          {view.similar && topArea && (
            <section aria-labelledby="similar-heading" className="border-hairline rounded-lg border p-5">
              <h2 id="similar-heading" className="text-xl font-bold">
                Podobne zgłoszenia
              </h2>
              <p className="mt-2 text-lg">
                {view.similar.count === 0
                  ? `W ostatnich ${view.similar.days} dniach nikt inny nie pytał o obszar „${MAPA_AREA_LABEL[topArea]}”. Twoje zgłoszenie pomoże ROPS zobaczyć tę potrzebę.`
                  : `W ostatnich ${view.similar.days} dniach ${view.similar.count} ${plural(view.similar.count, "osoba pytała", "osoby pytały", "osób pytało")} o obszar „${MAPA_AREA_LABEL[topArea]}”.`}
                {view.similar.powiatCount !== null && view.similar.count > 0
                  ? ` Z tego ${view.similar.powiatCount} z Twojego powiatu${view.similar.powiatName ? ` (${view.similar.powiatName})` : ""}.`
                  : ""}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">Liczymy anonimowe wyszukiwania w serwisie, bez treści opisów.</p>
            </section>
          )}
        </div>
      )}

      <RequestHelp
        runId={runId}
        query={view.query}
        areas={view.areas}
        gminaTeryt={view.place?.gminaTeryt ?? null}
        powiatTeryt={view.place?.powiatTeryt ?? null}
        resultTitles={abstained ? [] : view.results.map((r) => r.card.title)}
        abstained={abstained}
      />

      <div data-no-print>
        <button type="button" className={btnSecondary} onClick={() => window.print()}>
          Drukuj
        </button>
      </div>
    </div>
  );
}
