"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpenIcon, LightbulbIcon, PencilRulerIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";

import { AreaTag, SourceLine } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { useLabels } from "~/i18n/use-labels";
import type { IdeaStage, MapaArea } from "~/lib/domain";
import type { AssistResult } from "~/server/ideas/assist-rules";
import type { SelfScore } from "~/server/ideas/schema";
import type { Sketch } from "~/server/ideas/sketch-rules";
import { api } from "~/trpc/react";
import { useErrorText } from "./client-utils";
import { IdeaSketch } from "./idea-sketch";

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
  /** Language of the call's texts ("pl" when not translated). */
  lang?: "pl" | "en";
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

/**
 * „To już istnieje?" — keyword comparison with the library; works without the
 * AI. While the person types, the previous list stays in place (no flicker),
 * and screen readers hear one short line — only when the count changes.
 */
export function SimilarCheck({ text }: { text: string }) {
  const t = useTranslations("ideas.similar");
  const debounced = useDebounced(text.trim(), 700);
  const enabled = debounced.length >= 40;
  const q = api.ideas.similar.useQuery(
    { text: debounced },
    { enabled, staleTime: 60_000, placeholderData: keepPreviousData },
  );
  const list = q.data ?? [];
  const summary = !enabled
    ? ""
    : q.isError
      ? t("error")
      : q.data === undefined
        ? t("checking")
        : t("found", { count: list.length });

  return (
    <section aria-labelledby="similar-heading" className="border-hairline rounded-lg border p-5">
      <h3 id="similar-heading" className="font-display flex items-center gap-2 text-xl font-bold">
        <BookOpenIcon aria-hidden="true" className="size-5" />
        {t("heading")}
      </h3>
      {!enabled ? <p className="text-muted-foreground mt-3">{t("idle")}</p> : null}
      {/* One short live line; it changes only when the count does. */}
      <p role="status" className={summary ? "mt-3 font-semibold" : undefined}>
        {summary}
      </p>
      {enabled && q.data && list.length > 0 ? (
        <>
          <p className="mt-1">{t("joinAuthors")}</p>
          <ul className="mt-3 flex flex-col gap-3" aria-busy={q.isFetching}>
            {list.map((s) => (
              <li key={s.innovationId} className="border-hairline border-t pt-3">
                <Link
                  href={`/library/${s.slug}`}
                  lang={s.lang === "en" ? undefined : "pl"}
                  className="text-primary text-lg font-semibold underline underline-offset-4"
                >
                  {s.title}
                </Link>
                <p className="mt-1 text-[0.9375rem]" lang={s.lang === "en" ? undefined : "pl"}>
                  {s.summary}
                </p>
                {s.authors ? <p className="text-muted-foreground mt-1 text-sm">{t("authors", { names: s.authors })}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {enabled && q.data && list.length === 0 ? <p className="mt-1">{t("noneHint")}</p> : null}
      <SourceLine className="mt-3" source={t("source")} href={LIBRARY_URL} detail={t("sourceDetail")} />
    </section>
  );
}

function sameDraft(a: AssistDraft, b: AssistDraft) {
  return a.title === b.title && a.description === b.description && a.targetGroup === b.targetGroup && a.stage === b.stage;
}

const toInput = (d: AssistDraft) => ({
  title: d.title,
  description: d.description,
  targetGroup: d.targetGroup,
  areas: d.areas,
  stage: d.stage ?? undefined,
});

/**
 * The AI panel: questions, unusual angles, Mapa areas, the IWS self-assessment
 * and „Narysuj szkic pomysłu". New results take the focus (their heading) —
 * no live region, so nothing is announced twice.
 */
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
  const t = useTranslations("ideas.assistant");
  const labels = useLabels();
  const errorText = useErrorText();
  const assist = api.ideas.assist.useMutation();
  const [askedFor, setAskedFor] = useState<AssistDraft | null>(null);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [state, setState] = useState<"idle" | "unavailable" | "failed" | "error">("idle");
  const [error, setError] = useState("");
  const [focusTick, setFocusTick] = useState(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const ready = draft.description.trim().length >= 30;
  const stale = askedFor && !sameDraft(askedFor, draft);

  async function ask() {
    setError("");
    try {
      const snapshot = { ...draft };
      const res = await assist.mutateAsync(toInput(draft));
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
    setFocusTick((n) => n + 1);
  }

  useEffect(() => {
    if (focusTick > 0) resultHeading.current?.focus();
  }, [focusTick]);

  return (
    <section aria-labelledby="assistant-heading" className="border-hairline rounded-lg border p-5">
      <h3 id="assistant-heading" className="font-display flex items-center gap-2 text-xl font-bold">
        <SparklesIcon aria-hidden="true" className="size-5" />
        {t("heading")}
      </h3>
      <p className="mt-2">{t("intro")}</p>
      <Button type="button" variant="secondary" className="mt-4 w-full sm:w-auto" disabled={!ready || assist.isPending} onClick={() => void ask()}>
        {result ? <RefreshCwIcon aria-hidden="true" /> : <LightbulbIcon aria-hidden="true" />}
        {assist.isPending ? t("thinking") : result ? t("askAgain") : t("ask")}
      </Button>
      {!ready ? <p className="text-muted-foreground mt-2">{t("needDescription")}</p> : null}

      <div aria-busy={assist.isPending}>
        {state === "unavailable" || state === "failed" || state === "error" ? (
          <div className="border-hairline mt-4 border-l-4 pl-4">
            <h4 ref={resultHeading} tabIndex={-1} className="text-lg font-semibold outline-none">
              {state === "unavailable" ? t("unavailable") : t("noAnswer")}
            </h4>
            <p className="mt-1">{state === "error" ? error : t("continueWithout")}</p>
            {criteria ? <ManualCriteria criteria={criteria} /> : null}
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 flex flex-col gap-6">
            <h4 ref={resultHeading} tabIndex={-1} className="sr-only outline-none">
              {t("resultHeading")}
            </h4>
            {stale ? <p className="border-input rounded-md border border-dashed px-3 py-2">{t("stale")}</p> : null}

            {result.questions.length ? (
              <div>
                <h4 className="text-lg font-semibold">{t("questions")}</h4>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-6">
                  {result.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {result.angles.length ? (
              <div>
                <h4 className="text-lg font-semibold">{t("angles")}</h4>
                <ul className="mt-2 flex flex-col gap-3">
                  {result.angles.map((a) => (
                    <li key={a.title} className="border-hairline border-t pt-3">
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-1">{a.idea}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.areaFit.length ? (
              <div>
                <h4 className="text-lg font-semibold">{t("areas")}</h4>
                <ul className="mt-2 flex flex-col gap-3">
                  {result.areaFit.map((a) => (
                    <li key={a.area} className="flex flex-col gap-2">
                      <AreaTag area={a.area} />
                      <p>{a.why}</p>
                      {draft.areas.includes(a.area) ? (
                        <p className="text-muted-foreground text-sm">{t("areaChosen")}</p>
                      ) : (
                        <Button type="button" variant="outline" className="w-fit" onClick={() => onAddArea(a.area)}>
                          {t("addArea", { area: labels.area[a.area] })}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.selfScore ? (
              <SelfScoreView score={result.selfScore} callName={criteria?.callName ?? null} sourceUrl={criteria?.sourceUrl ?? null} />
            ) : null}
            <p className="text-muted-foreground text-sm">{t("aiNote")}</p>
          </div>
        ) : null}
      </div>

      <SketchPanel draft={draft} ready={ready} />
    </section>
  );
}

/** „Narysuj szkic pomysłu" — rate-limited like the assistant; drawn by the page. */
function SketchPanel({ draft, ready }: { draft: AssistDraft; ready: boolean }) {
  const t = useTranslations("ideas.sketch");
  const errorText = useErrorText();
  const draw = api.ideas.sketch.useMutation();
  const [sketch, setSketch] = useState<Sketch | null>(null);
  const [problem, setProblem] = useState("");
  const [focusTick, setFocusTick] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  async function run() {
    setProblem("");
    try {
      const res = await draw.mutateAsync(toInput(draft));
      if (res.ok) setSketch(res.sketch);
      else {
        setSketch(null);
        setProblem(res.reason === "unavailable" ? t("unavailable") : t("failed"));
      }
    } catch (e) {
      setSketch(null);
      setProblem(errorText(e));
    }
    setFocusTick((n) => n + 1);
  }

  useEffect(() => {
    if (focusTick > 0) heading.current?.focus();
  }, [focusTick]);

  return (
    <div className="border-hairline mt-6 border-t pt-5">
      <h4 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
        {t("heading")}
      </h4>
      <p className="mt-1">{t("intro")}</p>
      <Button type="button" variant="outline" className="mt-3 w-full sm:w-auto" disabled={!ready || draw.isPending} onClick={() => void run()}>
        <PencilRulerIcon aria-hidden="true" />
        {draw.isPending ? t("drawing") : sketch ? t("again") : t("draw")}
      </Button>
      <div aria-busy={draw.isPending} className="mt-4">
        {problem ? <p className="border-hairline border-l-4 pl-3">{problem}</p> : null}
        {sketch && !problem ? <IdeaSketch sketch={sketch} /> : null}
      </div>
    </div>
  );
}

/** The self-assessment as a readable list with the total against the call minimum. */
export function SelfScoreView({ score, callName, sourceUrl }: { score: SelfScore; callName: string | null; sourceUrl: string | null }) {
  const t = useTranslations("ideas.selfScore");
  return (
    <div>
      <h4 className="text-lg font-semibold">{t("heading")}</h4>
      <p className="text-muted-foreground mt-1 text-[0.9375rem]">
        {callName ? t("introCall", { name: callName }) : t("intro")}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {score.items.map((i) => (
          <li key={i.key} className="border-hairline border-t pt-3">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{i.label}</span>
              <span className="tabular text-lg font-bold">{t("points", { score: i.score, max: i.max })}</span>
            </p>
            {i.minToPass !== null ? (
              <p className="text-sm">{t("minimum", { min: i.minToPass, met: i.score >= i.minToPass ? "yes" : "no" })}</p>
            ) : null}
            <p className="mt-1">{i.reason}</p>
            <p className="mt-1">
              <span className="font-semibold">{t("improve")} </span>
              {i.improve}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-hairline bg-surface mt-3 rounded-md border p-3 text-lg">
        {t("total")} <span className="tabular font-bold">{t("points", { score: score.total, max: score.max })}</span>
        {score.minScore !== null ? <> — {t("totalMinimum", { min: score.minScore })} </> : ". "}
        <span className="font-semibold">{score.meetsMinimum ? t("meets") : t("below")}</span>
      </p>
      {sourceUrl ? (
        <SourceLine className="mt-2" source={t("source", { name: callName ?? t("sourceFallback") })} href={sourceUrl} />
      ) : null}
    </div>
  );
}

/** Without the AI: the criteria as a checklist to assess on one's own. */
function ManualCriteria({ criteria }: { criteria: NonNullable<CriteriaInfo> }) {
  const t = useTranslations("ideas.selfScore");
  const total = criteria.items.reduce((a, c) => a + c.max, 0);
  return (
    <details className="mt-3">
      <summary className="min-h-12 cursor-pointer py-2 font-semibold">{t("manual", { name: criteria.callName })}</summary>
      <ul className="mt-2 flex flex-col gap-2" lang={criteria.lang === "pl" ? "pl" : undefined}>
        {criteria.items.map((c) => (
          <li key={c.key}>
            <span className="font-semibold">
              {c.minToPass !== null ? t("manualItemMin", { label: c.label, max: c.max, min: c.minToPass }) : t("manualItem", { label: c.label, max: c.max })}
            </span>{" "}
            {c.description}
          </li>
        ))}
      </ul>
      {criteria.minScore !== null ? <p className="mt-2">{t("manualMinimum", { min: criteria.minScore, total })}</p> : null}
      {criteria.sourceUrl ? <SourceLine className="mt-2" source={t("source", { name: criteria.callName })} href={criteria.sourceUrl} /> : null}
    </details>
  );
}
