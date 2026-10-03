import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { aiAvailable } from "~/server/ai/structured";
import { matchProblem } from "~/server/ai/match";
import type { Db } from "~/server/db";
import { matchRuns } from "~/server/db/schema";
import { detectCrisis, type CrisisCategory } from "~/server/domain/crisis";
import { redactPII } from "~/server/domain/redact";
import type { MapaArea, SectionKey } from "~/server/domain/types";
import {
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
import { knowledgeFacts, powiatOf, type KnowledgeFact } from "./data-files";
import { loadPaths, similarRuns, type Path, type Similar } from "./joins";
import { getLibrary } from "./library";

export class MatchNotFoundError extends Error {
  constructor() {
    super("match run not found");
  }
}

type Ctx = { db: Db; sessionId: string | null };
type Run = typeof matchRuns.$inferSelect;

export type CardSummary = {
  id: string;
  slug: string;
  title: string;
  areas: MapaArea[];
  categoryLabels: string[];
  badge: string | null;
  videoUrl: string | null;
  sourceUrl: string;
  capturedAt: string;
  /** The card's own „Kto może skorzystać" section, shortened. */
  whoCanUse: string | null;
};

export type ResultCard = {
  card: CardSummary;
  verified: boolean;
  why: string;
  userTerms: string[];
  evidence: { id: string; text: string; section: SectionKey }[];
  firstStep: string | null;
  path: Path;
};

export type MatchView = {
  runId: string;
  createdAt: string;
  query: string;
  crisis: { urgent: boolean; categories: CrisisCategory[] };
  stage: Decision["stage"];
  note: Decision["note"];
  aiAvailable: boolean;
  userTerms: string[];
  areas: MapaArea[];
  results: ResultCard[];
  knowledge: KnowledgeFact | null;
  similar: Similar | null;
  libraryCount: number;
};

function shorten(s: string, max: number): string | null {
  const t = s.replace(/\s+/gu, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function buildView(run: Run, catalog: Catalog, ctx: Ctx): Promise<MatchView> {
  const keyword = run.keywordResult as StoredKeyword;
  const ai = (run.aiResult ?? null) as StoredAi | null;
  const decision = decide(catalog, keyword, ai, aiAvailable(), run.areas);
  const cards = decision.results.flatMap((r) => {
    const c = catalog.byId.get(r.cardId);
    return c ? [c] : [];
  });
  const topArea = decision.areas[0];
  const [paths, similar] = await Promise.all([
    loadPaths(ctx.db, cards),
    similarRuns(ctx.db, { runId: run.id, area: topArea, powiatTeryt: run.powiatTeryt }),
  ]);
  const results: ResultCard[] = decision.results.flatMap((r) => {
    const c = catalog.byId.get(r.cardId);
    if (!c) return [];
    return [
      {
        card: {
          id: c.id,
          slug: c.slug,
          title: c.title,
          areas: c.mapaAreas,
          categoryLabels: c.categoryLabels,
          badge: c.badge,
          videoUrl: c.videoUrl,
          sourceUrl: c.sourceUrl,
          capturedAt: c.capturedAt,
          whoCanUse: shorten(c.sections.whoCanUse, 280),
        },
        verified: r.verified,
        why: r.why,
        userTerms: r.userTerms,
        evidence: r.evidence,
        firstStep: r.firstStep,
        path: paths.get(c.id) ?? { sites: [], helpers: [], funding: [] },
      },
    ];
  });
  const userTerms = compactTerms([...results.flatMap((r) => r.userTerms), ...keyword.userTerms]).slice(0, 8);
  const crisis = detectCrisis(run.queryRedacted);
  return {
    runId: run.id,
    createdAt: run.createdAt.toISOString(),
    query: run.queryRedacted,
    crisis: { urgent: run.crisis || crisis.urgent, categories: crisis.categories },
    stage: decision.stage,
    note: decision.note,
    aiAvailable: aiAvailable(),
    userTerms,
    areas: decision.areas,
    results,
    knowledge: topArea ? (knowledgeFacts().get(topArea) ?? null) : null,
    similar,
    libraryCount: catalog.cards.length,
  };
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
  const redacted = redactPII(input.text.trim()).text;
  const crisis = detectCrisis(redacted);
  const catalog = await getLibrary();
  const keyword = runKeyword(catalog, redacted);
  const digits = input.gminaTeryt?.replace(/[^0-9]/g, "");
  const gmina = digits === undefined || digits === "" ? null : digits;
  const [run] = await ctx.db
    .insert(matchRuns)
    .values({
      queryRedacted: redacted,
      gminaTeryt: gmina,
      powiatTeryt: powiatOf(gmina),
      areas: runAreas(catalog, keyword),
      keywordResult: keyword,
      status: "keyword",
      crisis: crisis.urgent,
      sessionId: ctx.sessionId,
    })
    .returning();
  if (!run) throw new Error("match run was not saved");
  return buildView(run, catalog, ctx);
}

const inflight = new Map<string, Promise<MatchView>>();

/**
 * The AI step. Idempotent: a run that already has an AI result returns it, and
 * concurrent calls for the same run share one AI call. `beforeAi` runs only
 * when an AI call is about to be made (rate limiting).
 */
export function refineMatch(runId: string, ctx: Ctx, opts: { beforeAi?: () => Promise<void> } = {}): Promise<MatchView> {
  const running = inflight.get(runId);
  if (running) return running;
  const p = doRefine(runId, ctx, opts).finally(() => inflight.delete(runId));
  inflight.set(runId, p);
  return p;
}

async function doRefine(runId: string, ctx: Ctx, opts: { beforeAi?: () => Promise<void> }): Promise<MatchView> {
  const run = await loadRun(ctx.db, runId);
  const catalog = await getLibrary();
  if (run.aiResult) return buildView(run, catalog, ctx);
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
    const ai = await matchProblem({ query: run.queryRedacted, compactIndex: catalog.compactIndex, candidates });
    stored = verifyAi(ai, { redactedQuery: run.queryRedacted, catalog, keyword });
  }
  const [updated] = await ctx.db
    .update(matchRuns)
    .set({
      aiResult: stored,
      status: stored.abstained ? "abstained" : stored.ok ? "ai" : "error",
      abstained: stored.abstained,
      areas: stored.areas.length > 0 ? stored.areas : run.areas,
    })
    .where(and(eq(matchRuns.id, runId), isNull(matchRuns.aiResult)))
    .returning();
  return buildView(updated ?? (await loadRun(ctx.db, runId)), catalog, ctx);
}

export async function getMatchView(runId: string, ctx: Ctx): Promise<MatchView> {
  const run = await loadRun(ctx.db, runId);
  return buildView(run, await getLibrary(), ctx);
}
