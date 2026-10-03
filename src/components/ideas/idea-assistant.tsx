"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpenIcon, LightbulbIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";

import { AreaTag, SourceLine } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { MAPA_AREA_LABEL, type IdeaStage, type MapaArea } from "~/lib/domain";
import type { AssistResult } from "~/server/ideas/assist-rules";
import type { SelfScore } from "~/server/ideas/schema";
import { api } from "~/trpc/react";
import { errorText } from "./client-utils";

export type AssistDraft = {
  title: string;
  description: string;
  targetGroup: string;
  areas: MapaArea[];
  stage: IdeaStage | null;
};

export type CriteriaInfo = {
  callId: string;
  callName: string;
  minScore: number | null;
  sourceUrl: string | null;
  items: { key: string; label: string; max: number; minToPass: number | null; description: string | null }[];
} | null;

const LIBRARY_URL = "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** „To już istnieje?" — keyword comparison with the library; works without the AI. */
export function SimilarCheck({ text }: { text: string }) {
  const debounced = useDebounced(text.trim(), 700);
  const enabled = debounced.length >= 40;
  const q = api.ideas.similar.useQuery({ text: debounced }, { enabled, staleTime: 60_000 });
  return (
    <section aria-labelledby="similar-heading" className="border-hairline rounded-lg border p-5">
      <h3 id="similar-heading" className="font-display flex items-center gap-2 text-xl font-bold">
        <BookOpenIcon aria-hidden="true" className="size-5" />
        Czy to już istnieje?
      </h3>
      <div aria-live="polite" className="mt-3">
        {!enabled ? (
          <p className="text-muted-foreground">Gdy opiszesz pomysł, porównamy go z Biblioteką Innowacji Społecznych.</p>
        ) : q.isPending ? (
          <p>Sprawdzamy Bibliotekę…</p>
        ) : q.isError ? (
          <p>Nie udało się teraz sprawdzić Biblioteki. Możesz kontynuować.</p>
        ) : q.data.length === 0 ? (
          <p>Nie znaleźliśmy w Bibliotece podobnego rozwiązania. To dobry znak dla nowego pomysłu.</p>
        ) : (
          <>
            <p className="font-semibold">
              Podobne rozwiązania już istnieją — może dołączysz do ich autorów zamiast zaczynać od zera?
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {q.data.map((s) => (
                <li key={s.innovationId} className="border-hairline bg-surface rounded-md border p-3">
                  <Link href={`/library/${s.slug}`} className="text-primary text-lg font-semibold underline underline-offset-4">
                    {s.title}
                  </Link>
                  <p className="mt-1 text-[0.9375rem]">{s.summary}</p>
                  {s.authors ? <p className="text-muted-foreground mt-1 text-sm">Autorzy: {s.authors}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <SourceLine className="mt-3" source="Biblioteka Innowacji Społecznych ROPS Kraków" href={LIBRARY_URL} detail="porównanie słów, bez AI" />
    </section>
  );
}

function sameDraft(a: AssistDraft, b: AssistDraft) {
  return a.title === b.title && a.description === b.description && a.targetGroup === b.targetGroup && a.stage === b.stage;
}

/** The AI panel: questions, unusual angles, Mapa areas and the IWS self-assessment. */
export function IdeaAssistant({
  draft,
  criteria,
  onAddArea,
  onSelfScore,
}: {
  draft: AssistDraft;
  criteria: CriteriaInfo;
  onAddArea: (a: MapaArea) => void;
  onSelfScore: (s: SelfScore | null) => void;
}) {
  const assist = api.ideas.assist.useMutation();
  const [askedFor, setAskedFor] = useState<AssistDraft | null>(null);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [state, setState] = useState<"idle" | "unavailable" | "failed" | "error">("idle");
  const [error, setError] = useState("");
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const ready = draft.description.trim().length >= 30;
  const stale = askedFor && !sameDraft(askedFor, draft);

  async function ask() {
    setError("");
    try {
      const snapshot = { ...draft };
      const res = await assist.mutateAsync({
        title: draft.title,
        description: draft.description,
        targetGroup: draft.targetGroup,
        areas: draft.areas,
        stage: draft.stage ?? undefined,
      });
      setAskedFor(snapshot);
      if (res.ok) {
        setResult(res.result);
        setState("idle");
        onSelfScore(res.result.selfScore);
      } else {
        setResult(null);
        setState(res.reason);
        onSelfScore(null);
      }
    } catch (e) {
      setState("error");
      setError(errorText(e));
    }
  }

  useEffect(() => {
    if (result || state !== "idle") resultHeading.current?.focus();
  }, [result, state]);

  return (
    <section aria-labelledby="assistant-heading" className="border-hairline rounded-lg border p-5">
      <h3 id="assistant-heading" className="font-display flex items-center gap-2 text-xl font-bold">
        <SparklesIcon aria-hidden="true" className="size-5" />
        Asystent AI
      </h3>
      <p className="mt-2">
        Zada pytania, które pomogą dopracować pomysł, podsunie nietuzinkowe warianty i oceni go wstępnie według kryteriów naboru. Nie musisz z niego korzystać.
      </p>
      <Button type="button" variant="secondary" className="mt-4 w-full sm:w-auto" disabled={!ready || assist.isPending} onClick={() => void ask()}>
        {result ? <RefreshCwIcon aria-hidden="true" /> : <LightbulbIcon aria-hidden="true" />}
        {assist.isPending ? "Asystent myśli… (do 30 sekund)" : result ? "Zapytaj ponownie" : "Poproś o podpowiedzi"}
      </Button>
      {!ready ? <p className="text-muted-foreground mt-2">Najpierw opisz pomysł w kroku 1 (co najmniej dwa zdania).</p> : null}

      <div aria-live="polite" aria-busy={assist.isPending}>
        {state === "unavailable" || state === "failed" || state === "error" ? (
          <div className="border-hairline bg-surface mt-4 rounded-md border border-l-4 p-4">
            <h4 ref={resultHeading} tabIndex={-1} className="text-lg font-semibold outline-none">
              {state === "unavailable" ? "Asystent AI chwilowo niedostępny" : "Asystent nie odpowiedział"}
            </h4>
            <p className="mt-1">
              {state === "error" ? error : "Możesz dokończyć zgłoszenie bez niego — pomysł przeczyta zespół ROPS."}
            </p>
            {criteria ? <ManualCriteria criteria={criteria} /> : null}
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 flex flex-col gap-6">
            <h4 ref={resultHeading} tabIndex={-1} className="sr-only outline-none">
              Podpowiedzi asystenta
            </h4>
            {stale ? (
              <p className="border-input rounded-md border border-dashed px-3 py-2">
                Zmieniłaś/eś fiszkę od ostatniej podpowiedzi. Kliknij „Zapytaj ponownie”, żeby ocena dotyczyła aktualnej wersji.
              </p>
            ) : null}

            {result.questions.length ? (
              <div>
                <h4 className="text-lg font-semibold">Pytania, które warto sobie zadać</h4>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-6">
                  {result.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {result.angles.length ? (
              <div>
                <h4 className="text-lg font-semibold">Nietuzinkowe warianty</h4>
                <ul className="mt-2 flex flex-col gap-3">
                  {result.angles.map((a) => (
                    <li key={a.title} className="border-hairline rounded-md border p-3">
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-1">{a.idea}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.areaFit.length ? (
              <div>
                <h4 className="text-lg font-semibold">Pasuje do obszarów Mapy Wyzwań</h4>
                <ul className="mt-2 flex flex-col gap-3">
                  {result.areaFit.map((a) => (
                    <li key={a.area} className="flex flex-col gap-2">
                      <AreaTag area={a.area} />
                      <p>{a.why}</p>
                      {draft.areas.includes(a.area) ? (
                        <p className="text-muted-foreground text-sm">Ten obszar jest już wybrany.</p>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onAddArea(a.area)}>
                          Dodaj obszar „{MAPA_AREA_LABEL[a.area]}”
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.selfScore ? <SelfScoreView score={result.selfScore} callName={criteria?.callName ?? null} sourceUrl={criteria?.sourceUrl ?? null} /> : null}
            <p className="text-muted-foreground text-sm">Podpowiedzi przygotowała sztuczna inteligencja na podstawie Twojej fiszki. Sprawdź je — mogą się mylić.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The self-assessment as a readable list with the total against the call minimum. */
export function SelfScoreView({ score, callName, sourceUrl }: { score: SelfScore; callName: string | null; sourceUrl: string | null }) {
  return (
    <div>
      <h4 className="text-lg font-semibold">Wstępna samoocena (nie jest oceną ROPS)</h4>
      <p className="text-muted-foreground mt-1 text-[0.9375rem]">
        Kryteria oceny merytorycznej{callName ? ` naboru „${callName}”` : ""}: każde od 0 do 10 punktów.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {score.items.map((i) => (
          <li key={i.key} className="border-hairline rounded-md border p-3">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{i.label}</span>
              <span className="tabular text-lg font-bold">
                {i.score} / {i.max} pkt
              </span>
            </p>
            {i.minToPass !== null ? (
              <p className="text-sm">
                Minimum w tym kryterium: {i.minToPass} pkt — {i.score >= i.minToPass ? "spełnione" : "niespełnione"}.
              </p>
            ) : null}
            <p className="mt-1">{i.reason}</p>
            <p className="mt-1">
              <span className="font-semibold">Co poprawić: </span>
              {i.improve}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-hairline bg-surface mt-3 rounded-md border p-3 text-lg">
        Razem: <span className="tabular font-bold">{score.total} / {score.max} pkt</span>
        {score.minScore !== null ? <> — minimum to {score.minScore} pkt. </> : ". "}
        <span className="font-semibold">{score.meetsMinimum ? "Wstępnie spełnia minimum." : "Wstępnie poniżej minimum — zobacz, co poprawić."}</span>
      </p>
      {sourceUrl ? <SourceLine className="mt-2" source={`Kryteria: ${callName ?? "nabór ROPS"}`} href={sourceUrl} /> : null}
    </div>
  );
}

/** Without the AI: the five criteria as a checklist to assess on one's own. */
function ManualCriteria({ criteria }: { criteria: NonNullable<CriteriaInfo> }) {
  return (
    <details className="mt-3">
      <summary className="min-h-12 cursor-pointer py-2 font-semibold">Oceń sam(a): kryteria naboru „{criteria.callName}”</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {criteria.items.map((c) => (
          <li key={c.key}>
            <span className="font-semibold">
              {c.label} (0–{c.max} pkt{c.minToPass !== null ? `, minimum ${c.minToPass}` : ""}):
            </span>{" "}
            {c.description}
          </li>
        ))}
      </ul>
      {criteria.minScore !== null ? <p className="mt-2">Minimum łącznie: {criteria.minScore} pkt na 50.</p> : null}
      {criteria.sourceUrl ? <SourceLine className="mt-2" source={`Kryteria: ${criteria.callName}`} href={criteria.sourceUrl} /> : null}
    </details>
  );
}
