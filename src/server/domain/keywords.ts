/**
 * The instant keyword matcher: a MiniSearch index over the library cards with a
 * Polish stemmer and an everyday-language synonym layer. No network, no model;
 * it answers in a few milliseconds and is what the page shows while the AI
 * match is still running, and what it falls back to when the AI fails.
 */
import MiniSearch from "minisearch";
import { fold, isStopword, normalize, stem, tokenize, tokenizeWithOffsets, type Token } from "./polish";
import { PII_PLACEHOLDERS } from "./redact";
import { AGE_BANDS, SYNONYM_GROUPS, type SynonymGroup } from "./synonyms";
import type { LibraryCard, MapaArea } from "./types";

/** Field boosts: title 3, keywords 2, problems and target group 1.5, the rest 1. */
export const FIELD_BOOSTS = {
  title: 3,
  keywords: 2,
  problems: 1.5,
  targetGroup: 1.5,
  solution: 1,
  whoCanUse: 1,
  categoryLabels: 1,
} as const;
type Field = keyof typeof FIELD_BOOSTS;
const FIELDS = Object.keys(FIELD_BOOSTS) as Field[];

/** A word the resident typed counts fully; a word reached through a synonym counts this much. */
export const EXPANSION_WEIGHT = 0.6;

/**
 * A raw MiniSearch score at or above this maps to normScore 1.
 *
 * Calibrated on 2026-10-03 on the frozen eval set (eval/cases.json), against an
 * approximation of the library (listing blurbs for all 115 cards, full sections
 * for three), because data/library.json did not exist yet. On that run the two
 * no-answer cases topped out at raw 8.6 (normScore 0.09) and the weakest top
 * answer of any other case scored raw 115 (two-word "niewidomy telefon"). The
 * threshold 0.25 (raw 25) sits roughly geometrically between them, leaving
 * room for the full card texts to raise both sides.
 * Re-check with `pnpm eval` once the real library lands: the runner prints a
 * suggested threshold.
 */
export const SCORE_FOR_FULL_CONFIDENCE = 100;
/** Best normScore below this means the keyword match is not to be trusted. */
export const LOW_CONFIDENCE_THRESHOLD = 0.25;

type IndexedDoc = { id: string } & Record<Field, string>;

export type KeywordIndex = {
  mini: MiniSearch<IndexedDoc>;
  /** cardId → stem → the card's own spelling of the first word with that stem. */
  surface: Map<string, Map<string, string>>;
  cardsById: Map<string, LibraryCard>;
};

/** Index-time term processing: fold, drop stopwords and single letters, stem. */
export function processTerm(term: string): string | null {
  const f = fold(term);
  if (f.length < 2 || isStopword(f)) return null;
  return stem(f);
}

function cardFields(card: LibraryCard): Record<Field, string> {
  return {
    title: card.title,
    keywords: card.keywords.join(" "),
    problems: card.sections.problems,
    targetGroup: card.sections.targetGroup,
    solution: card.sections.solution,
    whoCanUse: card.sections.whoCanUse,
    categoryLabels: card.categoryLabels.join(" "),
  };
}

export function buildKeywordIndex(cards: readonly LibraryCard[]): KeywordIndex {
  const mini = new MiniSearch<IndexedDoc>({
    fields: FIELDS,
    idField: "id",
    tokenize: (text) => tokenize(text),
    processTerm: (term) => processTerm(term) ?? null,
  });
  const surface = new Map<string, Map<string, string>>();
  const cardsById = new Map<string, LibraryCard>();
  const docs: IndexedDoc[] = [];
  for (const card of cards) {
    if (cardsById.has(card.id)) continue;
    cardsById.set(card.id, card);
    const fields = cardFields(card);
    docs.push({ id: card.id, ...fields });
    const words = new Map<string, string>();
    for (const field of FIELDS) {
      for (const token of tokenizeWithOffsets(fields[field])) {
        const s = processTerm(token.text);
        if (s && !words.has(s)) words.set(s, token.text);
      }
    }
    surface.set(card.id, words);
  }
  mini.addAll(docs);
  return { mini, surface, cardsById };
}

// ---------------------------------------------------------------------------
// Query analysis
// ---------------------------------------------------------------------------

const POLISH_DIACRITIC = /[ąćęłńóśźż]/iu;

/** The stem, but spelled with the word's own diacritics (folding is one character for one). */
function diacriticStem(word: string): string {
  const n = normalize(word).replace(/[^\p{L}\p{M}\p{N}]/gu, "");
  return n.slice(0, stem(word).length);
}

type TriggerWord = { folded: string; withDiacritics: string };
type CompiledTrigger = { group: SynonymGroup; phrase: string; words: TriggerWord[] };

function compileWord(word: string): TriggerWord {
  return { folded: stem(word), withDiacritics: diacriticStem(word) };
}

let compiledTriggers: CompiledTrigger[] | null = null;
function triggers(): CompiledTrigger[] {
  if (compiledTriggers) return compiledTriggers;
  compiledTriggers = [];
  for (const group of SYNONYM_GROUPS) {
    for (const phrase of [...group.triggers, ...group.expansions]) {
      const words = tokenize(phrase).map(compileWord);
      if (words.length > 0) compiledTriggers.push({ group, phrase, words });
    }
  }
  return compiledTriggers;
}

type QueryWord = Token & { folded: string; stemFolded: string; stemDiacritics: string; stop: boolean };

/**
 * A trigger word meets a typed word when their stems are equal, or the typed
 * word's stem extends a trigger stem of four or more letters. When the resident
 * types with diacritics anywhere in the text, the diacritics must agree too
 * ("lęki" is not "leki"); text typed without any is compared folded.
 */
function wordMatches(t: TriggerWord, q: QueryWord, compareDiacritics: boolean): boolean {
  const ts = compareDiacritics ? t.withDiacritics : t.folded;
  const qs = compareDiacritics ? q.stemDiacritics : q.stemFolded;
  if (ts === qs) return true;
  return ts.length >= 4 && qs.startsWith(ts);
}

export type QueryTerm = {
  /** The processed (stemmed) term as sent to the index. */
  term: string;
  weight: number;
  /** The resident's own words (as typed) that produced this term. */
  sources: string[];
  /** True when the resident typed it; false when it came from a synonym. */
  direct: boolean;
};

export type QueryAnalysis = {
  terms: QueryTerm[];
  triggeredGroups: { id: string; areas: MapaArea[]; matched: string[] }[];
  detectedAreas: MapaArea[];
};

const AGE = /(?<![\p{L}\p{N}])(\d{1,3})[  ]?-?[  ]?(?:lat|lata|latek|latka|latki|letni\p{L}*|letnia|r\.ż\.)(?![\p{L}])/gu;
const AGE_AFTER_PO = /(?<![\p{L}\p{N}])po[  ](\d{2,3})(?![\p{N}])/gu;
const DURATION_BEFORE = /(?:^|[^\p{L}])(?:od|przez|za|do)[  ]*$/u;
const DURATION_AFTER = /^[^\p{L}]*temu(?![\p{L}])/u;

function detectAges(text: string): { age: number; surface: string }[] {
  const out: { age: number; surface: string }[] = [];
  for (const m of text.matchAll(AGE)) {
    const before = text.slice(Math.max(0, m.index - 8), m.index).toLowerCase();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12).toLowerCase();
    if (DURATION_BEFORE.test(before) || DURATION_AFTER.test(after)) continue;
    out.push({ age: Number(m[1]), surface: m[0] });
  }
  for (const m of text.matchAll(AGE_AFTER_PO)) {
    const age = Number(m[1]);
    if (age >= 60 && age <= 120) out.push({ age, surface: m[0] });
  }
  return out;
}

/** Redaction placeholders ("[telefon]") are not the resident's words; "telefon" must not reach the matcher. */
const PLACEHOLDERS = new RegExp(
  Object.values(PII_PLACEHOLDERS)
    .map((p) => p.replace(/[[\]\\^$.*+?(){}|]/g, "\\$&"))
    .join("|"),
  "gu",
);

export function stripPlaceholders(text: string): string {
  return text.replace(PLACEHOLDERS, " ");
}

export function analyzeQuery(query: string): QueryAnalysis {
  const text = stripPlaceholders(query.normalize("NFC"));
  const compareDiacritics = POLISH_DIACRITIC.test(text);
  const words: QueryWord[] = tokenizeWithOffsets(text).map((t) => ({
    ...t,
    stemFolded: stem(t.text),
    stemDiacritics: diacriticStem(t.text),
    stop: t.folded.length < 2 || isStopword(t.folded),
  }));

  const terms = new Map<string, QueryTerm>();
  const add = (term: string, weight: number, sources: string[], direct: boolean) => {
    const existing = terms.get(term);
    if (existing) {
      existing.weight = Math.max(existing.weight, weight);
      existing.direct ||= direct;
      for (const s of sources) if (!existing.sources.includes(s)) existing.sources.push(s);
    } else {
      terms.set(term, { term, weight, sources: [...sources], direct });
    }
  };

  for (const w of words) {
    if (!w.stop) add(w.stemFolded, 1, [w.text], true);
  }

  const triggered = new Map<string, { group: SynonymGroup; matched: string[]; extra: string[] }>();
  const trigger = (group: SynonymGroup, matched: string[], extra: string[] = []) => {
    const entry = triggered.get(group.id) ?? { group, matched: [], extra: [] };
    for (const m of matched) if (!entry.matched.includes(m)) entry.matched.push(m);
    for (const e of extra) if (!entry.extra.includes(e)) entry.extra.push(e);
    triggered.set(group.id, entry);
  };

  for (const t of triggers()) {
    const n = t.words.length;
    for (let i = 0; i + n <= words.length; i++) {
      let ok = true;
      for (let j = 0; j < n && ok; j++) ok = wordMatches(t.words[j]!, words[i + j]!, compareDiacritics);
      if (!ok) continue;
      const span = words.slice(i, i + n);
      // A phrase trigger is reported as typed; a single stopword alone ("sam") is still a trigger.
      const surface = n === 1 ? span[0]!.text : text.slice(span[0]!.start, span[n - 1]!.end);
      trigger(t.group, [surface]);
    }
  }

  for (const { age, surface } of detectAges(text)) {
    for (const band of AGE_BANDS) {
      if (age < band.min || age > band.max) continue;
      const group = SYNONYM_GROUPS.find((g) => g.id === band.groupId);
      if (group) trigger(group, [surface], band.extraExpansions);
    }
  }

  const triggeredGroups: QueryAnalysis["triggeredGroups"] = [];
  const detectedAreas: MapaArea[] = [];
  for (const { group, matched, extra } of triggered.values()) {
    triggeredGroups.push({ id: group.id, areas: group.areas, matched });
    for (const a of group.areas) if (!detectedAreas.includes(a)) detectedAreas.push(a);
    for (const phrase of [...group.expansions, ...extra]) {
      for (const word of tokenize(phrase)) {
        const term = processTerm(word);
        if (term) add(term, EXPANSION_WEIGHT, matched, false);
      }
    }
  }

  return { terms: [...terms.values()], triggeredGroups, detectedAreas };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type KeywordHit = {
  cardId: string;
  score: number;
  /** 0..1: score relative to SCORE_FOR_FULL_CONFIDENCE, capped at 1. */
  normScore: number;
  /** The resident's own words (as typed) that led to this card, for highlighting. */
  matchedUserTerms: string[];
  /** The card's own words that matched, as spelled on the card. */
  matchedCardTerms: string[];
  areas: MapaArea[];
};

export type KeywordResult = {
  results: KeywordHit[];
  detectedAreas: MapaArea[];
  isLowConfidence: boolean;
};

export function normalizeScore(score: number): number {
  if (!(score > 0)) return 0;
  return Math.min(1, score / SCORE_FOR_FULL_CONFIDENCE);
}

export function keywordSearch(
  index: KeywordIndex,
  cards: readonly LibraryCard[],
  query: string,
  { limit = 10 }: { limit?: number } = {},
): KeywordResult {
  const analysis = analyzeQuery(query);
  if (analysis.terms.length === 0) {
    return { results: [], detectedAreas: analysis.detectedAreas, isLowConfidence: true };
  }
  const byTerm = new Map(analysis.terms.map((t) => [t.term, t]));
  const cardsById = cards.length > 0 ? new Map(cards.map((c) => [c.id, c])) : index.cardsById;

  const raw = index.mini.search(analysis.terms.map((t) => t.term).join(" "), {
    // Terms are already processed; split on the spaces we joined them with.
    tokenize: (s) => s.split(" "),
    processTerm: (t) => t,
    boost: { ...FIELD_BOOSTS },
    boostTerm: (term) => byTerm.get(term)?.weight ?? 1,
    prefix: (term) => term.length >= 4,
    fuzzy: (term) => (term.length >= 6 ? 1 : false),
    combineWith: "OR",
  });

  const results: KeywordHit[] = [];
  for (const r of raw) {
    if (results.length >= limit) break;
    const cardId = String(r.id);
    const card = cardsById.get(cardId) ?? index.cardsById.get(cardId);
    if (!card) continue;
    const matchedUserTerms: string[] = [];
    for (const qt of r.queryTerms) {
      for (const s of byTerm.get(qt)?.sources ?? []) {
        if (!matchedUserTerms.includes(s)) matchedUserTerms.push(s);
      }
    }
    const words = index.surface.get(cardId);
    const matchedCardTerms: string[] = [];
    for (const t of r.terms) {
      const w = words?.get(t);
      if (w && !matchedCardTerms.includes(w)) matchedCardTerms.push(w);
    }
    results.push({
      cardId,
      score: r.score,
      normScore: normalizeScore(r.score),
      matchedUserTerms,
      matchedCardTerms,
      areas: card.mapaAreas,
    });
  }

  const best = results[0]?.normScore ?? 0;
  return { results, detectedAreas: analysis.detectedAreas, isLowConfidence: best < LOW_CONFIDENCE_THRESHOLD };
}
