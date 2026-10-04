/**
 * Pure matchmaking core: the catalog, the keyword step, the verification of the
 * AI answer and the decision of what the resident sees. No DB, no SDK, no
 * `server-only`, so the same code runs in the server, the eval and the tests.
 *
 * Two keyword indexes: the Polish cards as published, and their English
 * translations (`card.en`). In English mode both run and each card keeps its
 * best score, so Polish typed on the English site still finds its cards.
 */
import { createHash } from "node:crypto";

import type { Locale } from "~/i18n/config";
import { buildCompactIndex } from "~/server/ai/prompts/match";
import type { AiResult } from "~/server/ai/structured";
import { stemEn } from "~/server/domain/english";
import {
  buildKeywordIndex,
  keywordSearch,
  LOW_CONFIDENCE_THRESHOLD,
  type KeywordHit,
  type KeywordIndex,
  type KeywordResult,
} from "~/server/domain/keywords";
import { fold, stem } from "~/server/domain/polish";
import {
  SECTION_KEYS,
  type LibraryCard,
  type LibraryCardEn,
  type LibrarySentence,
  type MapaArea,
  type SectionKey,
} from "~/server/domain/types";
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
  /** Over the English translations; cards without a current one are not in it. */
  indexEn: KeywordIndex;
  compactIndex: string;
};

export function buildCatalog(cards: readonly LibraryCard[]): Catalog {
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  return {
    cards: sorted,
    byId: new Map(sorted.map((c) => [c.id, c])),
    bySlug: new Map(sorted.map((c) => [c.slug, c])),
    index: buildKeywordIndex(sorted),
    indexEn: buildKeywordIndex(sorted, { lang: "en" }),
    compactIndex: buildCompactIndex(sorted),
  };
}

/** innovations.en as stored (data/library.en.json): the translation plus the hash of what it was made from. */
export type StoredCardEn = LibraryCardEn & { sourceSha: string; badge?: string | null; translatedAt?: string };

/**
 * sha256 of the Polish title and sections a translation was made from — the
 * same recipe as scripts/translate-data.ts, with the sections in their
 * canonical order (a jsonb column does not keep key order).
 */
export function cardSourceSha(card: Pick<LibraryCard, "title" | "sections">): string {
  const sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, card.sections[k]]));
  return createHash("sha256").update(JSON.stringify(sections) + card.title).digest("hex");
}

/**
 * The English translation when it is current: made from this very text
 * (sourceSha) and covering every sentence id. Otherwise null, and the page
 * shows the Polish original (lang="pl").
 */
export function currentEnglish(
  card: Pick<LibraryCard, "title" | "sections" | "sentences">,
  en: StoredCardEn | null | undefined,
): LibraryCardEn | null {
  if (!en || typeof en !== "object" || !en.sentences || !en.sections) return null;
  if (en.sourceSha !== cardSourceSha(card)) return null;
  if (!card.sentences.every((s) => typeof en.sentences[s.id] === "string" && en.sentences[s.id]!.trim())) return null;
  return {
    title: en.title,
    sections: en.sections,
    sentences: en.sentences,
    keywords: en.keywords ?? [],
    categoryLabels: en.categoryLabels ?? [],
  };
}

/** Attaches data/library.en.json (id → StoredCardEn) to cards read from data/library.json (eval, scripts). */
export function withEnglish(cards: readonly LibraryCard[], enById: Readonly<Record<string, StoredCardEn>>): LibraryCard[] {
  return cards.map((c) => ({ ...c, en: currentEnglish(c, enById[c.id]) }));
}

/** The card's text in the language shown: English when a current translation exists, else Polish. */
export function cardText(card: LibraryCard, locale: Locale) {
  const en = locale === "en" ? (card.en ?? null) : null;
  const lang: Locale = en ? "en" : "pl";
  return {
    lang,
    title: en?.title ?? card.title,
    categoryLabels: en?.categoryLabels.length ? en.categoryLabels : card.categoryLabels,
    sections: en?.sections ?? card.sections,
    /** The English sentence for a Polish sentence id (null in Polish or without a translation). */
    sentenceEn: (id: string): string | null => en?.sentences[id] ?? null,
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
  en?: StoredCardEn | null;
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
    en: currentEnglish(row, row.en),
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
  /** "en" when the English translation scored best (matchedCardTerms are then English words). */
  lang?: "en";
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
/** The same for English ("person", "problem", "lives"). */
const GENERIC_STEMS_EN = new Set(
  ["person", "people", "problem", "help", "need", "needs", "lives", "live", "home", "house", "situation", "life", "time", "day", "year", "years", "old", "thing"].map(
    (w) => stemEn(w),
  ),
);

/** Keeps the words that explain a match; falls back to all of them when only general words matched. */
export function meaningfulTerms(terms: readonly string[]): string[] {
  const kept = terms.filter(
    (t) => t.includes(" ") || /\p{N}/u.test(t) || !(GENERIC_STEMS.has(stem(t)) || GENERIC_STEMS_EN.has(stemEn(t))),
  );
  return kept.length > 0 ? kept : [...terms];
}

/**
 * Both indexes, each card at its best score. A card the English translation
 * scored higher is marked `lang: "en"` (its matched card words are English).
 */
function searchBoth(catalog: Catalog, query: string): KeywordResult & { langById: Map<string, "en"> } {
  const pl = keywordSearch(catalog.index, catalog.cards, query, { limit: CANDIDATES });
  const en = keywordSearch(catalog.indexEn, catalog.cards, query, { limit: CANDIDATES });
  const best = new Map<string, KeywordHit>();
  const langById = new Map<string, "en">();
  for (const h of pl.results) best.set(h.cardId, h);
  for (const h of en.results) {
    const prev = best.get(h.cardId);
    if (!prev || h.normScore > prev.normScore) {
      best.set(h.cardId, h);
      langById.set(h.cardId, "en");
    }
  }
  const results = [...best.values()]
    .sort((a, b) => b.normScore - a.normScore || b.score - a.score || a.cardId.localeCompare(b.cardId))
    .slice(0, CANDIDATES);
  const detectedAreas = [...en.detectedAreas];
  for (const a of pl.detectedAreas) if (!detectedAreas.includes(a)) detectedAreas.push(a);
  const top = results[0]?.normScore ?? 0;
  return { results, detectedAreas, isLowConfidence: top < LOW_CONFIDENCE_THRESHOLD, langById };
}

/**
 * The instant keyword step. Polish: the Polish index. English: both indexes
 * (see searchBoth), so the English site also understands Polish.
 */
export function runKeyword(catalog: Catalog, redactedQuery: string, locale: Locale = "pl"): StoredKeyword {
  const r =
    locale === "en"
      ? searchBoth(catalog, redactedQuery)
      : { ...keywordSearch(catalog.index, catalog.cards, redactedQuery, { limit: CANDIDATES }), langById: new Map<string, "en">() };
  return {
    v: 1,
    hits: r.results.map((h) => ({
      cardId: h.cardId,
      score: Math.round(h.score * 10) / 10,
      normScore: Math.round(h.normScore * 1000) / 1000,
      matchedUserTerms: meaningfulTerms(compactTerms(h.matchedUserTerms)),
      matchedCardTerms: h.matchedCardTerms,
      ...(r.langById.has(h.cardId) ? { lang: "en" as const } : {}),
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
    // A failed call is an error, never an abstention: the AI did not say "nothing fits".
    return {
      v: 1,
      ok: false,
      reason: ai.reason,
      matches: [],
      abstained: false,
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
 * target-group and solution sections. Always a real sentence of the card (its
 * Polish id). With `lang: "en"` the matched words are English and are looked
 * for in the English translation of each sentence.
 */
export function pickEvidence(
  card: LibraryCard,
  matchedCardTerms: readonly string[],
  lang: "pl" | "en" = "pl",
): LibrarySentence | null {
  const terms = matchedCardTerms.map((t) => fold(t)).filter((t) => t.length >= 3);
  const english = lang === "en" ? (card.en?.sentences ?? null) : null;
  let best: { s: LibrarySentence; score: number } | null = null;
  for (const s of card.sentences) {
    if (s.section === "authors") continue;
    const text = fold(english?.[s.id] ?? s.text);
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

/**
 * „Pasuje, bo napisałaś/eś: „mieszka sama”, „myli leki”." — only the resident's
 * own words. English: "This fits because you wrote: “lives alone”, …".
 */
export function keywordWhy(userTerms: readonly string[], locale: Locale = "pl"): string {
  if (locale === "en") {
    const terms = userTerms.slice(0, 4).map((t) => `“${t}”`);
    if (terms.length === 0) return "This matches words from your description.";
    return `This fits because you wrote: ${terms.join(", ")}.`;
  }
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

function keywordResults(catalog: Catalog, keyword: StoredKeyword, locale: Locale): ResultCore[] {
  const out: ResultCore[] = [];
  for (const h of keyword.hits) {
    if (out.length >= SHOWN) break;
    const card = catalog.byId.get(h.cardId);
    if (!card) continue;
    const ev = pickEvidence(card, h.matchedCardTerms, h.lang ?? "pl");
    out.push({
      cardId: card.id,
      verified: false,
      why: keywordWhy(h.matchedUserTerms, locale),
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
 * is an abstention. A failed AI call is never an abstention: the page says the
 * check failed, offers to try again, and shows the keyword list only when it is
 * confident. `locale` is the language of the words the server writes itself
 * (the keyword „Pasuje, bo…").
 */
export function decide(
  catalog: Catalog,
  keyword: StoredKeyword,
  ai: StoredAi | null,
  aiAvailable: boolean,
  storedAreas: MapaArea[],
  locale: Locale = "pl",
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
    if (!ai.ok) {
      return {
        stage: "keyword",
        results: keyword.isLowConfidence ? [] : keywordResults(catalog, keyword, locale),
        note: "ai_error",
        areas,
      };
    }
    return { stage: "keyword", results: keywordResults(catalog, keyword, locale), note: "ai_no_better", areas };
  }
  if (!aiAvailable) {
    if (keyword.isLowConfidence) return { stage: "abstained", results: [], note: "ai_unavailable", areas };
    return { stage: "keyword", results: keywordResults(catalog, keyword, locale), note: "ai_unavailable", areas };
  }
  // AI pending: a weak keyword list is not worth showing while we wait.
  return {
    stage: "preliminary",
    results: keyword.isLowConfidence ? [] : keywordResults(catalog, keyword, locale),
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
