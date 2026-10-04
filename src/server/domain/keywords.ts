/**
 * The instant keyword matcher: a MiniSearch index over the library cards with a
 * stemmer and an everyday-language synonym layer, in Polish (the cards as
 * published) or English (their translations, `card.en`). No network, no model;
 * it answers in a few milliseconds and is what the page shows while the AI
 * match is still running, and what it falls back to when the AI fails.
 */
import MiniSearch from "minisearch";
import { isStopwordEn, processTermEn, stemEn } from "./english";
import { fold, isStopword, normalize, stem, tokenize, tokenizeWithOffsets, type Token } from "./polish";
import { ALL_PII_PLACEHOLDERS } from "./redact";
import { AGE_BANDS, SYNONYM_GROUPS, type AgeBand, type SynonymGroup } from "./synonyms";
import { AGE_BANDS_EN, SYNONYM_GROUPS_EN } from "./synonyms.en";
import type { LibraryCard, MapaArea } from "./types";

/** The language of an index and of the query analysis run against it. */
export type MatchLang = "pl" | "en";

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
 * normScore = log(1 + score) / log(1 + SCORE_FOR_FULL_CONFIDENCE), capped at 1.
 *
 * Raw MiniSearch scores grow with the number of matched query terms, so a long
 * story scores in the thousands and a two-word query in the hundreds. A linear
 * scale saturated at 1.00 for every answerable case; the log scale keeps them
 * apart and keeps the gap to unanswerable text visible.
 *
 * Calibrated on 2026-10-03 on the frozen eval set over the real library
 * (data/library.json, 114 cards): the two no-answer cases top out at raw 15.6
 * and 20.1 (normScore 0.36 and 0.40); the weakest top answer of any other case
 * is raw 412 ("samotny senior", 0.79), and stories reach 600–2,800 (0.84–1.00).
 * The threshold sits at raw ≈ 91, the geometric middle of 20 and 412.
 */
export const SCORE_FOR_FULL_CONFIDENCE = 2000;
/** Best normScore below this means the keyword match is not to be trusted. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

type IndexedDoc = { id: string } & Record<Field, string>;

export type KeywordIndex = {
  lang: MatchLang;
  mini: MiniSearch<IndexedDoc>;
  /** cardId → stem → the card's own spelling of the first word with that stem. */
  surface: Map<string, Map<string, string>>;
  cardsById: Map<string, LibraryCard>;
};

/** Index-time term processing (Polish): fold, drop stopwords and single letters, stem. */
export function processTerm(term: string): string | null {
  const f = fold(term);
  if (f.length < 2 || isStopword(f)) return null;
  return stem(f);
}

/** Everything that differs between the Polish and the English matcher. */
type LangProfile = {
  processTerm: (term: string) => string | null;
  stem: (word: string) => string;
  isStopword: (word: string) => boolean;
  groups: readonly SynonymGroup[];
  ageBands: readonly AgeBand[];
  detectAges: (text: string) => { age: number; surface: string }[];
  /** Compare diacritics when the text uses Polish ones („lęki" is not „leki"). */
  diacritics: boolean;
  /** The card text to index in this language; null when the card has none. */
  fields: (card: LibraryCard) => Record<Field, string> | null;
};

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

function cardFieldsEn(card: LibraryCard): Record<Field, string> | null {
  const en = card.en;
  if (!en) return null;
  return {
    title: en.title,
    keywords: en.keywords.join(" "),
    problems: en.sections.problems,
    targetGroup: en.sections.targetGroup,
    solution: en.sections.solution,
    whoCanUse: en.sections.whoCanUse,
    categoryLabels: en.categoryLabels.join(" "),
  };
}

export function buildKeywordIndex(cards: readonly LibraryCard[], { lang = "pl" }: { lang?: MatchLang } = {}): KeywordIndex {
  const profile = PROFILES[lang];
  const mini = new MiniSearch<IndexedDoc>({
    fields: FIELDS,
    idField: "id",
    tokenize: (text) => tokenize(text),
    processTerm: (term) => profile.processTerm(term) ?? null,
  });
  const surface = new Map<string, Map<string, string>>();
  const cardsById = new Map<string, LibraryCard>();
  const docs: IndexedDoc[] = [];
  for (const card of cards) {
    if (cardsById.has(card.id)) continue;
    const fields = profile.fields(card);
    if (!fields) continue;
    cardsById.set(card.id, card);
    docs.push({ id: card.id, ...fields });
    const words = new Map<string, string>();
    for (const field of FIELDS) {
      for (const token of tokenizeWithOffsets(fields[field])) {
        const s = profile.processTerm(token.text);
        if (s && !words.has(s)) words.set(s, token.text);
      }
    }
    surface.set(card.id, words);
  }
  mini.addAll(docs);
  return { lang, mini, surface, cardsById };
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

const compiledTriggers = new Map<MatchLang, CompiledTrigger[]>();
function triggers(lang: MatchLang): CompiledTrigger[] {
  const cached = compiledTriggers.get(lang);
  if (cached) return cached;
  const profile = PROFILES[lang];
  const compileWord = (word: string): TriggerWord =>
    profile.diacritics
      ? { folded: stem(word), withDiacritics: diacriticStem(word) }
      : { folded: profile.stem(word), withDiacritics: profile.stem(word) };
  const out: CompiledTrigger[] = [];
  for (const group of profile.groups) {
    for (const phrase of [...group.triggers, ...group.expansions]) {
      const words = tokenize(phrase).map(compileWord);
      if (words.length > 0) out.push({ group, phrase, words });
    }
  }
  compiledTriggers.set(lang, out);
  return out;
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

function detectAgesPl(text: string): { age: number; surface: string }[] {
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

/** "73 years old", "16-year-old", "aged 73", "Mum is 73", "over 70". Durations ("for 5 years") are not ages. */
const AGE_EN = /(?<![\p{L}\p{N}])(\d{1,3})[ \u00A0]?-?[ \u00A0]?(?:years?|yrs?)[ \u00A0]?-?[ \u00A0]?old(?![\p{L}])/giu;
const AGE_EN_AGED = /(?<![\p{L}\p{N}])aged[ \u00A0](\d{1,3})(?![\p{N}])/giu;
const AGE_EN_IS =
  /(?<![\p{L}\p{N}])(?:is|am|are|was|turned|turns|turning)[ \u00A0](\d{1,3})(?![\p{N}])(?![ \u00A0]?(?:%|percent|per|years?|yrs?|pounds?|euros?|eur|zł|zl|pln|złotys?|zlotys?|minutes?|hours?|days?|weeks?|months?|kg|km|m|cm|metres?|meters?)(?![\p{L}]))/giu;
const AGE_EN_OVER = /(?<![\p{L}\p{N}])(?:over|past)[ \u00A0](\d{2,3})(?![\p{N}])/giu;

function detectAgesEn(text: string): { age: number; surface: string }[] {
  const out: { age: number; surface: string }[] = [];
  for (const re of [AGE_EN, AGE_EN_AGED, AGE_EN_IS]) {
    for (const m of text.matchAll(re)) out.push({ age: Number(m[1]), surface: m[0] });
  }
  for (const m of text.matchAll(AGE_EN_OVER)) {
    const age = Number(m[1]);
    if (age >= 60 && age <= 120) out.push({ age, surface: m[0] });
  }
  return out;
}

const PROFILES: Record<MatchLang, LangProfile> = {
  pl: {
    processTerm,
    stem,
    isStopword: (w) => isStopword(w),
    groups: SYNONYM_GROUPS,
    ageBands: AGE_BANDS,
    detectAges: detectAgesPl,
    diacritics: true,
    fields: cardFields,
  },
  en: {
    processTerm: processTermEn,
    stem: stemEn,
    isStopword: isStopwordEn,
    groups: SYNONYM_GROUPS_EN,
    ageBands: AGE_BANDS_EN,
    detectAges: detectAgesEn,
    diacritics: false,
    fields: cardFieldsEn,
  },
};

/**
 * Redaction placeholders ("[telefon]", "[phone]") are not the resident's words;
 * "telefon" must not reach the matcher. Both languages' placeholders are removed.
 */
const PLACEHOLDERS = new RegExp(
  ALL_PII_PLACEHOLDERS.map((p) => p.replace(/[[\]\\^$.*+?(){}|]/g, "\\$&")).join("|"),
  "gu",
);

export function stripPlaceholders(text: string): string {
  return text.replace(PLACEHOLDERS, " ");
}

export function analyzeQuery(query: string, lang: MatchLang = "pl"): QueryAnalysis {
  const profile = PROFILES[lang];
  const text = stripPlaceholders(query.normalize("NFC"));
  const compareDiacritics = profile.diacritics && POLISH_DIACRITIC.test(text);
  const words: QueryWord[] = tokenizeWithOffsets(text).map((t) => {
    const s = profile.stem(t.text);
    return {
      ...t,
      stemFolded: s,
      stemDiacritics: profile.diacritics ? diacriticStem(t.text) : s,
      stop: t.folded.length < 2 || profile.isStopword(t.folded),
    };
  });

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

  for (const t of triggers(lang)) {
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

  for (const { age, surface } of profile.detectAges(text)) {
    for (const band of profile.ageBands) {
      if (age < band.min || age > band.max) continue;
      const group = profile.groups.find((g) => g.id === band.groupId);
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
        const term = profile.processTerm(word);
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
  /** 0..1 on a log scale relative to SCORE_FOR_FULL_CONFIDENCE (see there). */
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
  return Math.min(1, Math.log1p(score) / Math.log1p(SCORE_FOR_FULL_CONFIDENCE));
}

export function keywordSearch(
  index: KeywordIndex,
  cards: readonly LibraryCard[],
  query: string,
  { limit = 10 }: { limit?: number } = {},
): KeywordResult {
  const analysis = analyzeQuery(query, index.lang);
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
