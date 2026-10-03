import "server-only";

import { eq } from "drizzle-orm";

import type { MapaArea, SectionKey } from "~/lib/domain";
import { aiAvailable } from "~/server/ai/structured";
import { db } from "~/server/db";
import { matchRuns } from "~/server/db/schema";
import {
  decide,
  type Decision,
  type StoredAi,
  type StoredKeyword,
} from "~/server/match/core";
import { getLibrary } from "~/server/match/library";

/**
 * What the resident was shown before asking for help: the same decision the
 * match page makes (verified by AI, or keyword), with the resident's own
 * words and the card sentences quoted as evidence. Staff read it next to the
 * case, and triage drafts its reply from these cards first.
 */
export type MatchResultView = {
  cardId: string;
  slug: string;
  title: string;
  mapaAreas: MapaArea[];
  verified: boolean;
  why: string;
  userTerms: string[];
  evidence: { id: string; text: string; section: SectionKey }[];
  firstStep: string | null;
  sourceUrl: string;
  capturedAt: string;
};

export type MatchContext = {
  id: string;
  query: string;
  createdAt: Date;
  crisis: boolean;
  stage: Decision["stage"];
  note: Decision["note"];
  areas: MapaArea[];
  userTerms: string[];
  results: MatchResultView[];
};

function isStoredKeyword(v: unknown): v is StoredKeyword {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { hits?: unknown }).hits)
  );
}

export async function matchContext(
  runId: string,
): Promise<MatchContext | null> {
  const [run] = await db
    .select()
    .from(matchRuns)
    .where(eq(matchRuns.id, runId));
  if (!run) return null;
  const keyword: StoredKeyword = isStoredKeyword(run.keywordResult)
    ? run.keywordResult
    : {
        v: 1,
        hits: [],
        detectedAreas: [],
        isLowConfidence: true,
        userTerms: [],
      };
  const ai =
    run.aiResult && typeof run.aiResult === "object"
      ? (run.aiResult as StoredAi)
      : null;
  const catalog = await getLibrary();
  const decision = decide(catalog, keyword, ai, aiAvailable(), run.areas);
  return {
    id: run.id,
    query: run.queryRedacted,
    createdAt: run.createdAt,
    crisis: run.crisis,
    stage: decision.stage,
    note: decision.note,
    areas: decision.areas,
    userTerms: keyword.userTerms ?? [],
    results: decision.results.flatMap((r) => {
      const c = catalog.byId.get(r.cardId);
      if (!c) return [];
      return [
        {
          cardId: c.id,
          slug: c.slug,
          title: c.title,
          mapaAreas: c.mapaAreas,
          verified: r.verified,
          why: r.why,
          userTerms: r.userTerms,
          evidence: r.evidence,
          firstStep: r.firstStep,
          sourceUrl: c.sourceUrl,
          capturedAt: c.capturedAt,
        },
      ];
    }),
  };
}
