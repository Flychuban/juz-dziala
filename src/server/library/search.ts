/**
 * Library text search (pure, unit-tested). Polish words are stemmed by
 * cutting inflected endings; English words get a light stem (plural „s",
 * „-ies"/„-y", „-ing") so „families" also finds „family". Both are matched as
 * word prefixes, ignoring case and diacritics.
 */

/** Diacritic- and case-insensitive form (ą→a, ł→l …) for search. */
export function fold(text: string) {
  return text
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STOPWORDS_PL = new Set(
  "dla nie jak sie lub oraz jest sa mam mamy moja moj moje ktory ktora ktore przez przy czy ale tak to co ze od do po za na we ze mnie mi jego jej ich tez juz bardzo albo".split(
    " ",
  ),
);

const STOPWORDS_EN = new Set(
  "the and for with from that this who are was were have has had not you your yours our their they them his her its can will would should could what how into about also any all but out more some such than then there which when where why been being does did own very just one".split(
    " ",
  ),
);

function words(q: string | null | undefined): string[] {
  return fold(q ?? "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}

/** „samotność" → „samotn" (also finds „samotnych"); „seniorów" → „senio". */
export function polishStem(t: string): string {
  return t.length > 6
    ? t.slice(0, Math.max(5, t.length - 3))
    : t.length > 4
      ? t.slice(0, -1)
      : t;
}

/**
 * „families"/„family" → „famil"; „carers" → „carer"; „housing" → „hous";
 * „loneliness"/„lonely" → „lonel".
 */
export function englishStem(t: string): string {
  if (t.length > 7 && t.endsWith("ness")) {
    const base = t.slice(0, -4);
    return base.endsWith("i") ? base.slice(0, -1) : base;
  }
  if (t.length > 5 && t.endsWith("ies")) return t.slice(0, -3);
  if (t.length > 6 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("y")) return t.slice(0, -1);
  if (t.length > 4 && t.endsWith("es") && /(?:ss|sh|ch|x)es$/.test(t))
    return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss"))
    return t.slice(0, -1);
  return t;
}

/**
 * Turns a query into folded Polish word stems for prefix matching.
 * Stopwords are dropped.
 */
export function queryStems(q: string | null | undefined): string[] {
  const stems = words(q)
    .filter((t) => !STOPWORDS_PL.has(t))
    .map(polishStem);
  return [...new Set(stems)];
}

/** One word of the query: its Polish stem, and in English mode its English stem. */
export type QueryWord = { pl: string; en: string | null };

/**
 * The query as words to match. Polish mode: Polish stems only (unchanged
 * behaviour). English mode: each word may match either the English text by
 * its English stem or the Polish text by its Polish stem, so a Polish word
 * typed in English mode still works. Stopwords of both languages are dropped.
 */
export function queryWords(
  q: string | null | undefined,
  locale: string,
): QueryWord[] {
  if (locale !== "en") return queryStems(q).map((pl) => ({ pl, en: null }));
  const seen = new Set<string>();
  const out: QueryWord[] = [];
  for (const t of words(q)) {
    if (STOPWORDS_PL.has(t) || STOPWORDS_EN.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push({ pl: polishStem(t), en: englishStem(t) });
  }
  return out;
}

/** Stems to mark in the shown text (both languages; marking is prefix-based). */
export function highlightTerms(
  q: string | null | undefined,
  locale: string,
): string[] {
  return [
    ...new Set(
      queryWords(q, locale).flatMap((w) => (w.en ? [w.en, w.pl] : [w.pl])),
    ),
  ];
}

/** A word-prefix pattern for a folded stem. */
export function prefixRe(stem: string) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(stem)}`, "u");
}
