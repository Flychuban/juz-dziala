import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { Locale } from "~/i18n/config";
import { aiAvailable } from "~/server/ai/structured";
import { MATCH_DEADLINE_MS, matchProblem } from "~/server/ai/match";
import type { Db } from "~/server/db";
import { matchRuns } from "~/server/db/schema";
import { detectCrisis, type CrisisCategory } from "~/server/domain/crisis";
import { redactPII } from "~/server/domain/redact";
import type { MapaArea, SectionKey } from "~/server/domain/types";
import {
  cardText,
  compactTerms,
  decide,
  NO_CANDIDATES,
  runAreas,
  runKeyword,
  verifyAi,
  type Catalog,
  type Decision,
  type StoredAi,
  type StoredKeyword,
} from "./core";
import { gminaByTeryt, gminas, knowledgeFact, powiatOf, type KnowledgeFact } from "./data-files";
import { loadPaths, similarRuns, type Path, type PathFunding, type Similar } from "./joins";
import { getLibrary } from "./library";

export class MatchNotFoundError extends Error {
  constructor() {
    super("match run not found");
  }
}

type Ctx = { db: Db; sessionId: string | null; locale: Locale };
type Run = typeof matchRuns.$inferSelect;

export type CardSummary = {
  id: string;
  slug: string;
  /** In `lang`: English when the page is English and a current translation exists. */
  title: string;
  /** Language of title, categoryLabels and whoCanUse. */
  lang: Locale;
  areas: MapaArea[];
  categoryLabels: string[];
  badge: string | null;
  videoUrl: string | null;
  sourceUrl: string;
  capturedAt: string;
  /** The card's own „Kto może skorzystać" section, shortened. */
  whoCanUse: string | null;
};

export type Evidence = {
  id: string;
  /** The card's own (Polish) sentence for this id — what the match rests on. */
  text: string;
  section: SectionKey;
  /** The English translation of that sentence, on the English page (labelled as a translation). */
  translation: string | null;
};

export type ResultCard = {
  card: CardSummary;
  verified: boolean;
  why: string;
  /** Language of `why` and `firstStep` (the AI writes in the language the search was made in). */
  whyLang: Locale;
  userTerms: string[];
  evidence: Evidence[];
  firstStep: string | null;
  path: Path;
};

export type Place = {
  gminaTeryt: string;
  gminaName: string | null;
  gminaKind: string | null;
  powiatTeryt: string | null;
  powiatName: string | null;
};

export type MatchView = {
  runId: string;
  createdAt: string;
  /** The language the search was made in. */
  locale: Locale;
  query: string;
  /** The gmina picked on the home page, when any. */
  place: Place | null;
  crisis: { urgent: boolean; categories: CrisisCategory[] };
  stage: Decision["stage"];
  note: Decision["note"];
  aiAvailable: boolean;
  /** The longest the page waits for the AI check, in seconds (MATCH_DEADLINE_MS). */
  aiDeadlineSec: number;
  userTerms: string[];
  areas: MapaArea[];
  results: ResultCard[];
  /** The open (or demo) call for social innovations, shown once under all results. */
  funding: PathFunding | null;
  knowledge: (KnowledgeFact & { lang: Locale }) | null;
  similar: Similar | null;
  libraryCount: number;
};

function shorten(s: string, max: number): string | null {
  const t = s.replace(/\s+/gu, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function buildView(run: Run, catalog: Catalog, ctx: Ctx): Promise<MatchView> {
  const locale = ctx.locale;
  const keyword = run.keywordResult as StoredKeyword;
  const ai = (run.aiResult ?? null) as StoredAi | null;
  const decision = decide(catalog, keyword, ai, aiAvailable(), run.areas, locale);
  const cards = decision.results.flatMap((r) => {
    const c = catalog.byId.get(r.cardId);
    return c ? [c] : [];
  });
  const topArea = decision.areas[0];
  const place = placeOf(run);
  const [{ paths, general }, similar] = await Promise.all([
    loadPaths(ctx.db, cards),
    similarRuns(ctx.db, {
      runId: run.id,
      area: topArea,
      powiatTeryt: run.powiatTeryt,
      powiatName: place?.powiatName ?? null,
    }),
  ]);
  const runLocale: Locale = run.locale === "en" ? "en" : "pl";
  const results: ResultCard[] = decision.results.flatMap((r) => {
    const c = catalog.byId.get(r.cardId);
    if (!c) return [];
    const text = cardText(c, locale);
    return [
      {
        card: {
          id: c.id,
          slug: c.slug,
          title: text.title,
          lang: text.lang,
          areas: c.mapaAreas,
          categoryLabels: text.categoryLabels,
          badge: c.badge,
          videoUrl: c.videoUrl,
          sourceUrl: c.sourceUrl,
          capturedAt: c.capturedAt,
          whoCanUse: shorten(text.sections.whoCanUse, 280),
        },
        verified: r.verified,
        why: r.why,
        // The AI wrote in the search's language; the keyword sentence is written now, in the page's.
        whyLang: r.verified ? runLocale : locale,
        userTerms: r.userTerms,
        evidence: r.evidence.map((e) => ({ ...e, translation: text.sentenceEn(e.id) })),
        firstStep: r.firstStep,
        path: paths.get(c.id) ?? { runBy: [], mentor: null, funding: null },
      },
    ];
  });
  const userTerms = compactTerms([...results.flatMap((r) => r.userTerms), ...keyword.userTerms]).slice(0, 8);
  const crisis = detectCrisis(run.queryRedacted);
  return {
    runId: run.id,
    createdAt: run.createdAt.toISOString(),
    locale: runLocale,
    query: run.queryRedacted,
    place,
    crisis: { urgent: run.crisis || crisis.urgent, categories: crisis.categories },
    stage: decision.stage,
    note: decision.note,
    aiAvailable: aiAvailable(),
    aiDeadlineSec: Math.round(MATCH_DEADLINE_MS / 1000),
    userTerms,
    areas: decision.areas,
    results,
    funding: results.length > 0 ? general : null,
    knowledge: topArea ? knowledgeFact(topArea, locale) : null,
    similar,
    libraryCount: catalog.cards.length,
  };
}

function placeOf(run: Run): Place | null {
  if (!run.gminaTeryt) return null;
  const g = gminaByTeryt(run.gminaTeryt);
  return {
    gminaTeryt: run.gminaTeryt,
    gminaName: g?.name ?? null,
    gminaKind: g?.kind ?? null,
    powiatTeryt: run.powiatTeryt,
    powiatName: g?.powiatName ?? null,
  };
}

/** A gmina code is kept only when it is in data/gminas.json (or any 6–7 digits when that file is absent). */
function resolvePlace(gminaTeryt: string | null | undefined): { gminaTeryt: string | null; powiatTeryt: string | null } {
  const digits = gminaTeryt?.replace(/[^0-9]/g, "");
  if (digits === undefined || digits === "") return { gminaTeryt: null, powiatTeryt: null };
  if (gminas().length > 0) {
    const g = gminaByTeryt(digits);
    return g ? { gminaTeryt: g.teryt, powiatTeryt: g.powiatTeryt } : { gminaTeryt: null, powiatTeryt: null };
  }
  return { gminaTeryt: digits, powiatTeryt: powiatOf(digits) };
}

async function loadRun(db: Db, runId: string): Promise<Run> {
  const [run] = await db.select().from(matchRuns).where(eq(matchRuns.id, runId)).limit(1);
  if (!run) throw new MatchNotFoundError();
  return run;
}

/**
 * The instant step: redact, check for crisis, keyword-match, save the run.
 * Never calls the AI, so it answers in milliseconds.
 */
export async function startMatch(
  input: { text: string; gminaTeryt?: string | null },
  ctx: Ctx,
): Promise<MatchView> {
  const redacted = redactPII(input.text.trim(), ctx.locale).text;
  const crisis = detectCrisis(redacted);
  const catalog = await getLibrary();
  const keyword = runKeyword(catalog, redacted, ctx.locale);
  const place = resolvePlace(input.gminaTeryt);
  const [run] = await ctx.db
    .insert(matchRuns)
    .values({
      queryRedacted: redacted,
      gminaTeryt: place.gminaTeryt,
      powiatTeryt: place.powiatTeryt,
      areas: runAreas(catalog, keyword),
      keywordResult: keyword,
      status: "keyword",
      crisis: crisis.urgent,
      locale: ctx.locale,
      sessionId: ctx.sessionId,
    })
    .returning();
  if (!run) throw new Error("match run was not saved");
  return buildView(run, catalog, ctx);
}

const inflight = new Map<string, Promise<MatchView>>();

type RefineOpts = {
  /** Runs only when an AI call is about to be made (rate limiting). */
  beforeAi?: () => Promise<void>;
  /** Try again after a failed AI call (status "error"); a stored answer is never redone. */
  retry?: boolean;
};

/**
 * The AI step. Idempotent: a run that already has an AI result returns it, and
 * concurrent calls for the same run share one AI call. A failed call is stored
 * as status "error" (never as an abstention) and may be retried.
 */
export function refineMatch(runId: string, ctx: Ctx, opts: RefineOpts = {}): Promise<MatchView> {
  const running = inflight.get(runId);
  if (running) return running;
  const p = doRefine(runId, ctx, opts).finally(() => inflight.delete(runId));
  inflight.set(runId, p);
  return p;
}

async function doRefine(runId: string, ctx: Ctx, opts: RefineOpts): Promise<MatchView> {
  const run = await loadRun(ctx.db, runId);
  const catalog = await getLibrary();
  const previous = (run.aiResult ?? null) as StoredAi | null;
  if (previous && (previous.ok || !opts.retry)) return buildView(run, catalog, ctx);
  const keyword = run.keywordResult as StoredKeyword;

  if (!aiAvailable()) {
    // Keyword-only deployment: a weak keyword match is an abstention; record it for the trends.
    if (keyword.isLowConfidence && !run.abstained) {
      const [updated] = await ctx.db
        .update(matchRuns)
        .set({ status: "abstained", abstained: true })
        .where(eq(matchRuns.id, runId))
        .returning();
      return buildView(updated ?? run, catalog, ctx);
    }
    return buildView(run, catalog, ctx);
  }

  const candidates = keyword.hits.flatMap((h) => {
    const c = catalog.byId.get(h.cardId);
    return c ? [c] : [];
  });
  let stored: StoredAi;
  if (candidates.length === 0) {
    stored = verifyAi(NO_CANDIDATES, { redactedQuery: run.queryRedacted, catalog, keyword });
  } else {
    await opts.beforeAi?.();
    const ai = await matchProblem({
      query: run.queryRedacted,
      compactIndex: catalog.compactIndex,
      candidates,
      locale: run.locale === "en" ? "en" : "pl",
    });
    stored = verifyAi(ai, { redactedQuery: run.queryRedacted, catalog, keyword });
  }
  const [updated] = await ctx.db
    .update(matchRuns)
    .set({
      aiResult: stored,
      // A failed call is "error", not an abstention: the trends must not count it as an unmet need.
      status: !stored.ok ? "error" : stored.abstained ? "abstained" : "ai",
      abstained: stored.ok && stored.abstained,
      areas: stored.areas.length > 0 ? stored.areas : run.areas,
    })
    .where(
      previous
        ? and(eq(matchRuns.id, runId), eq(matchRuns.status, "error"))
        : and(eq(matchRuns.id, runId), isNull(matchRuns.aiResult)),
    )
    .returning();
  return buildView(updated ?? (await loadRun(ctx.db, runId)), catalog, ctx);
}

export async function getMatchView(runId: string, ctx: Ctx): Promise<MatchView> {
  const run = await loadRun(ctx.db, runId);
  return buildView(run, await getLibrary(), ctx);
}
