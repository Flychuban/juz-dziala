import "server-only";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { innovations } from "~/server/db/schema";
import { analyzeQuery, buildKeywordIndex, keywordSearch, type KeywordIndex } from "~/server/domain/keywords";
import type { LibraryCard } from "~/server/domain/types";
import { PRIVATE_AUTHORS, pickSimilar } from "./similar-rules";
import type { SimilarInnovation } from "./schema";

/**
 * „To już istnieje" — the duplicate check behind the Kreator. Keyword search
 * over the published library (no AI, a few ms), so it works when the assistant
 * is down. The index is rebuilt at most every 10 minutes, so a card ROPS
 * publishes shows up without a restart.
 */
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; index: KeywordIndex; cards: LibraryCard[] } | null = null;

async function libraryIndex() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const rows = await db.select().from(innovations).where(eq(innovations.status, "published"));
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
  cache = { at: Date.now(), index: buildKeywordIndex(cards), cards };
  return cache;
}

function summaryOf(card: LibraryCard): string {
  const first = card.sentences.find((s) => s.section === "solution")?.text ?? card.sections.solution;
  return first.length > 220 ? `${first.slice(0, 217).trimEnd()}…` : first;
}

/** Up to `limit` library cards that look like this idea, strongest first. */
export async function findSimilar(text: string, limit = 3): Promise<SimilarInnovation[]> {
  if (text.trim().length < 10) return [];
  const { index, cards } = await libraryIndex();
  const userWords = new Set(analyzeQuery(text).terms.flatMap((t) => t.sources)).size;
  const res = keywordSearch(index, cards, text, { limit: 10 });
  const hits = res.results.map((h) => ({ ...h, matchedWords: h.matchedUserTerms.length }));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return pickSimilar(hits, userWords, limit)
    .map((hit) => {
      const card = byId.get(hit.cardId);
      if (!card) return null;
      const authors = card.sections.authors
        .split("\n")
        .filter((l) => l.trim() && !PRIVATE_AUTHORS.test(l))
        .join(", ");
      return {
        innovationId: card.id,
        slug: card.slug,
        title: card.title,
        summary: summaryOf(card),
        authors: authors || null,
        normScore: Math.round((hit.matchedWords / userWords) * 100) / 100,
      } satisfies SimilarInnovation;
    })
    .filter((x): x is SimilarInnovation => x !== null);
}
