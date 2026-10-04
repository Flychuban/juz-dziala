/** Pure helpers for module I screens (server- and client-safe, unit-tested). */
import { fold } from "~/components/kit/format";

const PCT = new Intl.NumberFormat("pl-PL", { style: "percent", maximumFractionDigits: 0 });
export function formatPct(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "—" : PCT.format(rate);
}

/** „Inkubator Włączenia Społecznego 2.0" out of a call's long official name, when it quotes one. */
export function shortCallName(name: string): string {
  const quoted = /„([^”"]+)[”"]/u.exec(name)?.[1];
  if (!quoted) return name;
  return quoted.split(/\s[–-]\s/u)[0]!.trim();
}

export type GminaOption = {
  teryt: string;
  name: string;
  kind: string | null;
  powiatName: string | null;
};

/** The gmina kinds in data/gminas.json, as message keys (home.gmina.kind.*). */
export function gminaKindKey(kind: string): "urban" | "rural" | "mixed" | null {
  const k = kind.trim().toLowerCase();
  if (k === "miejska") return "urban";
  if (k === "wiejska") return "rural";
  if (k === "miejsko-wiejska") return "mixed";
  return null;
}

/**
 * „Bochnia — gmina miejska, powiat bocheński": unique even when two gminas
 * share a name. `kindLabel` words the kind in the page's language.
 */
export function gminaOptionLabel(g: GminaOption, kindLabel: (kind: string) => string = (k) => `gmina ${k}`): string {
  const parts = [g.kind ? kindLabel(g.kind) : null, g.powiatName].filter(Boolean);
  return parts.length > 0 ? `${g.name} — ${parts.join(", ")}` : g.name;
}

/**
 * Options whose name (or powiat) matches what was typed, ignoring case and
 * Polish diacritics; names starting with the text come first.
 */
export function filterGminas(query: string, options: readonly GminaOption[], limit = 8): GminaOption[] {
  const q = fold(query.trim());
  if (!q) return [];
  const starts: GminaOption[] = [];
  const contains: GminaOption[] = [];
  for (const g of options) {
    const name = fold(g.name);
    if (name.startsWith(q)) starts.push(g);
    else if (name.includes(q) || fold(g.powiatName ?? "").includes(q)) contains.push(g);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** A short case title from the redacted query: its first sentence, cut at a word near 80 characters. */
export function caseTitle(query: string, fallback = "Prośba o pomoc"): string {
  const first = query.replace(/\s+/gu, " ").trim().split(/(?<=[.!?])\s/u)[0] ?? "";
  let t = first;
  if (first.length > 80) {
    const cut = first.lastIndexOf(" ", 79);
    t = `${first.slice(0, cut > 40 ? cut : 79)}…`;
  }
  return t.length >= 3 ? t : fallback;
}

/** The words of a case body, in the language of its author (the staff read it as written). */
export type CaseWords = {
  query: (query: string) => string;
  askedAbout: (title: string) => string;
  abstained: string;
  shown: (titles: string) => string;
  quote: (title: string) => string;
};

export const CASE_WORDS_PL: CaseWords = {
  query: (q) => `Opis (bez danych osobowych): ${q}`,
  askedAbout: (t) => `Prośba dotyczy rozwiązania: „${t}”.`,
  abstained: "Wynik dopasowania: brak pewnego dopasowania w Bibliotece ROPS.",
  shown: (titles) => `Pokazane rozwiązania: ${titles}.`,
  quote: (t) => `„${t}”`,
};

/** The case body: the redacted description plus what the matcher showed, for the staff member. */
export function caseBody(
  query: string,
  resultTitles: readonly string[],
  abstained: boolean,
  askedAbout: string | null = null,
  words: CaseWords = CASE_WORDS_PL,
): string {
  const lines = [words.query(query.trim())];
  if (askedAbout) lines.push(words.askedAbout(askedAbout));
  if (abstained) lines.push(words.abstained);
  else if (resultTitles.length > 0) lines.push(words.shown(resultTitles.map(words.quote).join(", ")));
  return lines.join("\n");
}

const MONTH_YEAR: Record<"pl" | "en", Intl.DateTimeFormat> = {
  pl: new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "Europe/Warsaw" }),
  en: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/Warsaw" }),
};

/**
 * „s. 4, wydanie: listopad 2024" / "p. 4, edition: November 2024" — the page
 * and the source's own month, never a made-up day.
 */
export function knowledgeDetail(
  page: string | null,
  sourceDate: string | null,
  words: { locale: "pl" | "en"; page: (p: string) => string; edition: (month: string) => string } = {
    locale: "pl",
    page: (p) => `s. ${p}`,
    edition: (m) => `wydanie: ${m}`,
  },
): string | null {
  const parts: string[] = [];
  if (page) parts.push(words.page(page));
  const m = sourceDate ? /^(\d{4})-(\d{2})/u.exec(sourceDate) : null;
  if (m) parts.push(words.edition(MONTH_YEAR[words.locale].format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)))));
  return parts.length > 0 ? parts.join(", ") : null;
}
