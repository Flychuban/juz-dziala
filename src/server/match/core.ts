/**
 * Pure matchmaking core: the catalog, the keyword step, the verification of the
 * AI answer and the decision of what the resident sees. No DB, no SDK, no
 * `server-only`, so the same code runs in the server, the eval and the tests.
 */
import { buildCompactIndex } from "~/server/ai/prompts/match";
import type { AiResult } from "~/server/ai/structured";
import { buildKeywordIndex, keywordSearch, type KeywordIndex } from "~/server/domain/keywords";
import { fold, stem } from "~/server/domain/polish";
import type { LibraryCard, LibrarySentence, MapaArea, SectionKey } from "~/server/domain/types";
import { finalizeMatches, sanitizeAreas, type AiMatchOutput, type DropReason } from "~/server/domain/verify";

/** How many keyword hits are stored and offered to the AI as candidates. */
export const CANDIDATES = 15;
/** How many cards a resident sees. */
export const SHOWN = 3;

export type Catalog = {
  cards: LibraryCard[];
  byId: Map<string, LibraryCard>;
  bySlug: Map<string, LibraryCard>;
  index: KeywordIndex;
  compactIndex: string;
};

export function buildCatalog(cards: readonly LibraryCard[]): Catalog {
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  return {
    cards: sorted,
    byId: new Map(sorted.map((c) => [c.id, c])),
    bySlug: new Map(sorted.map((c) => [c.slug, c])),
    index: buildKeywordIndex(sorted),
    compactIndex: buildCompactIndex(sorted),
  };
}

/** A row of jd_innovation (structurally) → the LibraryCard the matcher works on. */
export function toLibraryCard(row: {
  id: string;
  slug: string;
  title: string;
  categories: string[];
  categoryLabels: string[];
  sections: Record<SectionKey, string>;
  sentences: LibrarySentence[];
  badge: string | null;
  videoUrl: string | null;
  folderUrl: string | null;
  materialsUrl: string | null;
  licence: string | null;
  licenceUrl: string | null;
  mapaAreas: MapaArea[];
  keywords: string[];
  sourceUrl: string;
  capturedAt: Date | string;
  sha256: string | null;
}): LibraryCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categories: row.categories,
    categoryLabels: row.categoryLabels,
    sections: row.sections,
    sentences: row.sentences,
    badge: row.badge,
    videoUrl: row.videoUrl,
    folderUrl: row.folderUrl,
    materialsUrl: row.materialsUrl,
    licence: row.licence,
    licenceUrl: row.licenceUrl,
    mapaAreas: row.mapaAreas,
    keywords: row.keywords,
    sourceUrl: row.sourceUrl,
    capturedAt: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : row.capturedAt,
    sha256: row.sha256 ?? "",
  };
}

// ---------------------------------------------------------------------------
// Stored shapes (jd_match_run.keywordResult / aiResult)
// ---------------------------------------------------------------------------

export type StoredKeywordHit = {
  cardId: string;
  score: number;
  normScore: number;
  matchedUserTerms: string[];
  matchedCardTerms: string[];
};

export type StoredKeyword = {
  v: 1;
  hits: StoredKeywordHit[];
  detectedAreas: MapaArea[];
  isLowConfidence: boolean;
  /** Every word of the resident's that hit any card, as typed. */
  userTerms: string[];
};

export type StoredAiMatch = {
  cardId: string;
  why: string;
  userTerms: string[];
  evidence: { id: string; text: string }[];
  firstStep: string;
};

export type StoredAi = {
  v: 1;
  /** The AI call itself succeeded (its answer may still have been abstain). */
  ok: boolean;
  reason?: string;
  matches: StoredAiMatch[];
  abstained: boolean;
  fallbackToKeyword: boolean;
  dropped: { innovationId: string; reason: DropReason }[];
  areas: MapaArea[];
  abstainReason?: string;
  allowedCardIds: string[];
  latencyMs: number;
  costUsd: number;
};

/**
 * Drops repeats and any term already contained, as whole words, in a longer
 * one: ["leki", "myli leki"] → ["myli leki"]. Keeps first-seen order.
 */
export function compactTerms(terms: readonly string[]): string[] {
  const unique: string[] = [];
  for (const t of terms) {
    const trimmed = t.trim();
    if (trimmed && !unique.some((u) => fold(u) === fold(trimmed))) unique.push(trimmed);
  }
  return unique.filter((t) => {
    const ft = ` ${fold(t)} `;
    return !unique.some((u) => u !== t && fold(u).length > fold(t).length && ` ${fold(u)} `.includes(ft));
  });
}

/** Single words too general to explain a match on their own ("osoba", "problem", "mieszka"). */
const GENERIC_STEMS = new Set(
  ["osoba", "problem", "pomoc", "potrzebuje", "mieszka", "sytuacja", "sprawa", "życie", "domu", "roku", "czas", "dzień", "rzecz", "lata", "lat"].map(
    (w) => stem(w),
  ),
);

/** Keeps the words that explain a match; falls back to all of them when only general words matched. */
export function meaningfulTerms(terms: readonly string[]): string[] {
  const kept = terms.filter((t) => t.includes(" ") || /\p{N}/u.test(t) || !GENERIC_STEMS.has(stem(t)));
  return kept.length > 0 ? kept : [...terms];
}

export function runKeyword(catalog: Catalog, redactedQuery: string): StoredKeyword {
  const r = keywordSearch(catalog.index, catalog.cards, redactedQuery, { limit: CANDIDATES });
  return {
    v: 1,
    hits: r.results.map((h) => ({
      cardId: h.cardId,
      score: Math.round(h.score * 10) / 10,
      normScore: Math.round(h.normScore * 1000) / 1000,
      matchedUserTerms: meaningfulTerms(compactTerms(h.matchedUserTerms)),
      matchedCardTerms: h.matchedCardTerms,
    })),
    detectedAreas: r.detectedAreas,
    isLowConfidence: r.isLowConfidence,
    userTerms: meaningfulTerms(compactTerms(r.results.flatMap((h) => h.matchedUserTerms))),
  };
}

/** Areas for the run: what the query says, else the areas of a confident top card. */
export function runAreas(catalog: Catalog, keyword: StoredKeyword): MapaArea[] {
  if (keyword.detectedAreas.length > 0) return keyword.detectedAreas;
  const top = keyword.hits[0];
  if (!top || keyword.isLowConfidence) return [];
  return catalog.byId.get(top.cardId)?.mapaAreas ?? [];
}

/** Stands in for the AI call when keyword search found no candidate at all: nothing can be verified. */
export const NO_CANDIDATES: AiResult<AiMatchOutput> = {
  ok: true,
  data: { matches: [], abstain: true, areas: [] },
  latencyMs: 0,
  costUsd: 0,
};

/** Turns the AI call's result into the stored, verified result. Never trusts an id it was not given. */
export function verifyAi(
  ai: AiResult<AiMatchOutput>,
  ctx: { redactedQuery: string; catalog: Catalog; keyword: StoredKeyword },
): StoredAi {
  const allowedCardIds = ctx.keyword.hits.map((h) => h.cardId);
  const keyword = { isLowConfidence: ctx.keyword.isLowConfidence };
  if (!ai.ok) {
    return {
      v: 1,
      ok: false,
      reason: ai.reason,
      matches: [],
      abstained: keyword.isLowConfidence,
      fallbackToKeyword: !keyword.isLowConfidence,
      dropped: [],
      areas: [],
      allowedCardIds,
      latencyMs: ai.latencyMs,
      costUsd: 0,
    };
  }
  const f = finalizeMatches(ai.data, {
    userText: ctx.redactedQuery,
    cardsById: ctx.catalog.byId,
    allowedCardIds: new Set(allowedCardIds),
    keyword,
  });
  return {
    v: 1,
    ok: true,
    matches: f.matches.map((m) => ({
      cardId: m.card.id,
      why: m.why,
      userTerms: m.userTerms,
      evidence: m.evidence,
      firstStep: m.firstStep,
    })),
    abstained: f.abstained,
    fallbackToKeyword: f.fallbackToKeyword,
    dropped: f.dropped,
    areas: sanitizeAreas(ai.data.areas),
    ...(ai.data.abstainReason ? { abstainReason: ai.data.abstainReason.slice(0, 300) } : {}),
    allowedCardIds,
    latencyMs: ai.latencyMs,
    costUsd: ai.costUsd,
  };
}

// ---------------------------------------------------------------------------
// What the resident sees
// ---------------------------------------------------------------------------

const SECTION_PREFERENCE: SectionKey[] = ["problems", "targetGroup", "solution", "whoCanUse", "doesItWork"];

/**
 * For a keyword result, the card's own sentence that best shows the match: the
 * one containing the most of the matched card words, preferring the problem,
 * target-group and solution sections. Always a real sentence of the card.
 */
export function pickEvidence(card: LibraryCard, matchedCardTerms: readonly string[]): LibrarySentence | null {
  const terms = matchedCardTerms.map((t) => fold(t)).filter((t) => t.length >= 3);
  let best: { s: LibrarySentence; score: number } | null = null;
  for (const s of card.sentences) {
    if (s.section === "authors") continue;
    const text = fold(s.text);
    const hits = terms.filter((t) => text.includes(t)).length;
    const pref = SECTION_PREFERENCE.indexOf(s.section);
    const score = hits * 10 - (pref === -1 ? 9 : pref);
    if (hits > 0 && (!best || score > best.score)) best = { s, score };
  }
  if (best) return best.s;
  for (const section of SECTION_PREFERENCE) {
    const s = card.sentences.find((x) => x.section === section);
    if (s) return s;
  }
  return card.sentences[0] ?? null;
}

/** „Pasuje, bo napisałaś/eś: „mieszka sama”, „myli leki”." — only the resident's own words. */
export function keywordWhy(userTerms: readonly string[]): string {
  const terms = userTerms.slice(0, 4).map((t) => `„${t}”`);
  if (terms.length === 0) return "Pasuje do słów z Twojego opisu.";
  return `Pasuje, bo napisałaś/eś: ${terms.join(", ")}.`;
}

export type Stage =
  /** Keyword results shown while the AI is still checking. */
  | "preliminary"
  /** AI-verified cards. */
  | "verified"
  /** Nothing certain: hand over to an expert. */
  | "abstained"
  /** Keyword results are final (AI unavailable, failed, or found nothing better). */
  | "keyword";

export type ResultCore = {
  cardId: string;
  verified: boolean;
  why: string;
  userTerms: string[];
  evidence: { id: string; text: string; section: SectionKey }[];
  firstStep: string | null;
  normScore: number | null;
};

export type Decision = {
  stage: Stage;
  results: ResultCore[];
  /** Shown under the results when the AI could not run or failed. */
  note: "ai_unavailable" | "ai_error" | "ai_no_better" | null;
  areas: MapaArea[];
};

function sectionOf(card: LibraryCard, sentenceId: string): SectionKey {
  return card.sentences.find((s) => s.id === sentenceId)?.section ?? "solution";
}

function keywordResults(catalog: Catalog, keyword: StoredKeyword): ResultCore[] {
  const out: ResultCore[] = [];
  for (const h of keyword.hits) {
    if (out.length >= SHOWN) break;
    const card = catalog.byId.get(h.cardId);
    if (!card) continue;
    const ev = pickEvidence(card, h.matchedCardTerms);
    out.push({
      cardId: card.id,
      verified: false,
      why: keywordWhy(h.matchedUserTerms),
      userTerms: h.matchedUserTerms.slice(0, 6),
      evidence: ev ? [{ id: ev.id, text: ev.text, section: ev.section }] : [],
      firstStep: null,
      normScore: h.normScore,
    });
  }
  return out;
}

/**
 * Decides what the page shows from what is stored. `aiAvailable` is false when
 * the server has no API key: then the keyword result is final, and a weak one
 * is an abstention.
 */
export function decide(
  catalog: Catalog,
  keyword: StoredKeyword,
  ai: StoredAi | null,
  aiAvailable: boolean,
  storedAreas: MapaArea[],
): Decision {
  const areas = ai && ai.areas.length > 0 ? ai.areas : storedAreas;
  if (ai) {
    if (ai.abstained) return { stage: "abstained", results: [], note: null, areas };
    if (ai.matches.length > 0) {
      const results: ResultCore[] = [];
      for (const m of ai.matches) {
        const card = catalog.byId.get(m.cardId);
        if (!card) continue;
        results.push({
          cardId: m.cardId,
          verified: true,
          why: m.why,
          userTerms: m.userTerms,
          evidence: m.evidence.map((e) => ({ ...e, section: sectionOf(card, e.id) })),
          firstStep: m.firstStep,
          normScore: keyword.hits.find((h) => h.cardId === m.cardId)?.normScore ?? null,
        });
      }
      if (results.length > 0) return { stage: "verified", results, note: null, areas };
    }
    return {
      stage: "keyword",
      results: keywordResults(catalog, keyword),
      note: ai.ok ? "ai_no_better" : "ai_error",
      areas,
    };
  }
  if (!aiAvailable) {
    if (keyword.isLowConfidence) return { stage: "abstained", results: [], note: "ai_unavailable", areas };
    return { stage: "keyword", results: keywordResults(catalog, keyword), note: "ai_unavailable", areas };
  }
  // AI pending: a weak keyword list is not worth showing while we wait.
  return {
    stage: "preliminary",
    results: keyword.isLowConfidence ? [] : keywordResults(catalog, keyword),
    note: null,
    areas,
  };
}

/** Slugs in display order, for the eval. */
export function decisionSlugs(catalog: Catalog, d: Decision): string[] {
  return d.results.flatMap((r) => {
    const slug = catalog.byId.get(r.cardId)?.slug;
    return slug ? [slug] : [];
  });
}
