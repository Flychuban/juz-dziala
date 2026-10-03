import "server-only";

import { and, count, eq, gte, max, ne } from "drizzle-orm";

import type { MapaArea } from "~/lib/domain";
import { db } from "~/server/db";
import { cases, innovations } from "~/server/db/schema";
import {
  buildKeywordIndex,
  keywordSearch,
  LOW_CONFIDENCE_THRESHOLD,
  type KeywordIndex,
} from "~/server/domain/keywords";
import { isStopword, stem, tokenize } from "~/server/domain/polish";
import type { LibraryCard } from "~/server/domain/types";

/**
 * Deterministic retrieval for triage: the library cards a reply draft may
 * quote (A0's calibrated keyword matcher — the same one the instant match
 * uses) and earlier cases that share the most word stems.
 */
let cached: { key: string; index: KeywordIndex; cards: LibraryCard[] } | null =
  null;

async function libraryIndex() {
  const published = eq(innovations.status, "published");
  const [stamp] = await db
    .select({ n: count(), at: max(innovations.updatedAt) })
    .from(innovations)
    .where(published);
  const key = `${stamp?.n ?? 0}:${stamp?.at?.toISOString() ?? ""}`;
  if (cached?.key === key) return cached;
  const rows = await db.select().from(innovations).where(published);
  const cards: LibraryCard[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    categories: r.categories,
    categoryLabels: r.categoryLabels,
    sections: r.sections,
    sentences: r.sentences,
    badge: r.badge,
    videoUrl: r.videoUrl,
    folderUrl: r.folderUrl,
    materialsUrl: r.materialsUrl,
    licence: r.licence,
    licenceUrl: r.licenceUrl,
    mapaAreas: r.mapaAreas,
    keywords: r.keywords,
    sourceUrl: r.sourceUrl,
    capturedAt: r.capturedAt.toISOString(),
    sha256: r.sha256 ?? "",
  }));
  cached = { key, index: buildKeywordIndex(cards), cards };
  return cached;
}

export type LibraryCandidate = {
  id: string;
  slug: string;
  title: string;
  mapaAreas: MapaArea[];
  score: number;
  /** The resident's words that led to the card. */
  matchedTerms: string[];
  /** First sentences of „Na czym polega rozwiązanie?" — the only text a draft may use. */
  sentences: { id: string; text: string }[];
};

export async function libraryCandidates(
  text: string,
  limit = 3,
): Promise<{ cards: LibraryCandidate[]; detectedAreas: MapaArea[] }> {
  const { index, cards } = await libraryIndex();
  if (!cards.length) return { cards: [], detectedAreas: [] };
  const res = keywordSearch(index, cards, text, { limit });
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out: LibraryCandidate[] = [];
  for (const hit of res.results) {
    // Below the calibrated threshold a keyword hit is noise, not a lead.
    if (hit.normScore < LOW_CONFIDENCE_THRESHOLD) continue;
    const c = byId.get(hit.cardId);
    if (!c) continue;
    const solution = c.sentences.filter((s) => s.section === "solution");
    const pool = solution.length ? solution : c.sentences;
    out.push({
      id: c.id,
      slug: c.slug,
      title: c.title,
      mapaAreas: c.mapaAreas,
      score: hit.normScore,
      matchedTerms: hit.matchedUserTerms,
      sentences: pool.slice(0, 2).map((s) => ({ id: s.id, text: s.text })),
    });
  }
  return { cards: out, detectedAreas: res.detectedAreas };
}

function stems(text: string): Set<string> {
  return new Set(
    tokenize(text)
      .filter((w) => w.length >= 4 && !isStopword(w))
      .map(stem),
  );
}

export type SimilarCaseCandidate = {
  id: string;
  code: string;
  title: string;
  excerpt: string;
  overlap: number;
};

/** Earlier cases (180 days) sharing the most word stems with this one. */
export async function similarCaseCandidates(
  caseId: string,
  text: string,
  limit = 8,
): Promise<SimilarCaseCandidate[]> {
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: cases.id,
      code: cases.code,
      title: cases.title,
      body: cases.bodyRedacted,
    })
    .from(cases)
    .where(and(ne(cases.id, caseId), gte(cases.createdAt, since)))
    .limit(500);
  const mine = stems(text);
  return rows
    .map((r) => {
      let overlap = 0;
      for (const s of stems(`${r.title} ${r.body}`)) if (mine.has(s)) overlap++;
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        excerpt: r.body.slice(0, 200),
        overlap,
      };
    })
    .filter((r) => r.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);
}
