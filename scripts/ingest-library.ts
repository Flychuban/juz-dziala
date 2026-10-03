/**
 * ROPS Kraków — Biblioteka Innowacji Społecznych → data/library.json
 *
 *   pnpm exec tsx scripts/ingest-library.ts          (reuses data/raw/ when present)
 *   REFRESH=1 pnpm exec tsx scripts/ingest-library.ts (fetches every page again)
 *
 * Reads the nine category listings, de-duplicates cards by slug (merging categories), fetches
 * each card page once and parses it. A card that cannot be parsed goes to
 * data/library.withheld.json with a reason; it is never dropped silently.
 */
import * as cheerio from "cheerio";
import { pathToFileURL } from "node:url";
import { anonymiseAuthors } from "./lib/authors";
import { politeFetch, writeJson } from "./lib/http";
import { extractKeywords } from "./lib/keywords";
import type { z } from "zod";
import { Library, LibraryWithheld, WithheldCard, type LibraryCard, type MapaArea, type SectionKey, type Sentence } from "./schemas";

// domhandler is cheerio's own dependency and not importable here; take its node types from cheerio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = ReturnType<cheerio.Cheerio<any>["contents"]> extends cheerio.Cheerio<infer T> ? T : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Element = ReturnType<cheerio.Cheerio<any>["children"]> extends cheerio.Cheerio<infer T> ? T : never;

export const LIBRARY_BASE = "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

export const CATEGORIES = [
  "dla-seniorow",
  "dla-dzieci-mlodziezy-i-rodziny",
  "dla-osob-o-ograniczonej-mobilnosci",
  "dla-osob-z-niepelnosprawnoscia-sensoryczna",
  "dla-zdrowia-i-medycyny",
  "dla-rynku-pracy",
  "dla-cudzoziemcow",
  "dla-osob-w-kryzysie-bezdomnosci",
  "dla-osob-z-niepelnosprawnoscia-intelektualna",
] as const;
export type CategorySlug = (typeof CATEGORIES)[number];

export const CATEGORY_TO_AREA: Record<CategorySlug, MapaArea> = {
  "dla-seniorow": "seniors",
  "dla-dzieci-mlodziezy-i-rodziny": "family",
  "dla-osob-o-ograniczonej-mobilnosci": "disability",
  "dla-osob-z-niepelnosprawnoscia-sensoryczna": "disability",
  "dla-osob-z-niepelnosprawnoscia-intelektualna": "disability",
  "dla-zdrowia-i-medycyny": "health",
  "dla-rynku-pracy": "poverty",
  "dla-cudzoziemcow": "migrants",
  "dla-osob-w-kryzysie-bezdomnosci": "homelessness",
};

const AREA_ORDER: MapaArea[] = ["family", "homelessness", "disability", "poverty", "migrants", "health", "mental_health", "seniors"];

// ------------------------------------------------------------------ text helpers

/** Collapse whitespace (incl. NBSP and zero-width) inside a line; keep the text otherwise verbatim. */
export function normaliseLine(s: string): string {
  return s
    .replace(/[   ]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t\f\v\r]+/g, " ")
    .trim();
}

/** Plain text of a fragment: <br> → line break, block children → paragraph breaks. */
function blockText($: cheerio.CheerioAPI, el: AnyNode): string[] {
  const BLOCK = new Set(["p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "blockquote", "section"]);
  const paragraphs: string[] = [];
  let buf = "";
  const flush = () => {
    const lines = buf
      .split("\n")
      .map(normaliseLine)
      .filter(Boolean);
    if (lines.length) paragraphs.push(lines.join("\n"));
    buf = "";
  };
  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      buf += (node as unknown as { data: string }).data.replace(/\s*\n\s*/g, " ");
      return;
    }
    if (node.type !== "tag") return;
    const tag = (node as Element).name.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "img") return;
    if (tag === "br") {
      buf += "\n";
      return;
    }
    const isBlock = BLOCK.has(tag);
    if (isBlock) flush();
    if (tag === "li") buf += "- ";
    for (const child of (node as Element).children) walk(child);
    if (isBlock) flush();
  };
  walk(el);
  flush();
  return paragraphs;
}

// ------------------------------------------------------------------ sections

const SECTION_PATTERNS: [SectionKey, RegExp][] = [
  ["solution", /na\s+czym\s+polega/i],
  ["problems", /jakich\s+problem|jakie\s+problem/i],
  ["targetGroup", /grup[ay]\s+docelow/i],
  ["whoCanUse", /kto\s+mo[żz]e\s+(skorzysta|wykorzysta|zastosowa)/i],
  ["doesItWork", /czy\s+to\s+dzia[łl]a/i],
  ["authors", /^\s*(\d+\s*[.)]\s*)?autor/i],
];

function headingKey(text: string): SectionKey | null {
  const t = normaliseLine(text);
  if (t.length > 80) return null; // a heading is short; a paragraph that mentions "grupa docelowa" is not one
  for (const [key, re] of SECTION_PATTERNS) if (re.test(t)) return key;
  return null;
}

function isHeadingElement($: cheerio.CheerioAPI, el: Element): boolean {
  if (/^h[1-6]$/i.test(el.name)) return true;
  if (el.name === "p") {
    const all = normaliseLine($(el).text());
    if (!all) return false;
    // <p><strong>1. Na czym polega…</strong></p> — a paragraph whose whole text is bold
    const bold = normaliseLine($(el).find("strong, b").text());
    if (bold === all) return true;
    // <p>1. Na czym polega rozwiązanie?</p> — a plain paragraph that is only a numbered heading
    // (seen on „Teleasystent"). Numbered and short, so body text that mentions a heading's words
    // cannot qualify.
    return all.length <= 60 && /^\d+\s*[.)]\s*\S/.test(all);
  }
  return false;
}

// ------------------------------------------------------------------ buttons

export function canonicalYouTube(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(embed|shorts|v|live)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[2] ?? null;
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * "https://creativecommons.org/licenses/by-sa/4.0/deed.pl" → "CC BY-SA 4.0".
 *
 * The cards from „Małopolski Inkubator Innowacji Społecznych" link (behind a © icon) to
 * Zasady_wykorzystania_innowacji_MIIS.pdf instead. That PDF (archived in data/raw/, see the
 * manifest) says the materials may be used only under a free, non-exclusive, non-transferable
 * licence agreement signed with Województwo Małopolskie – ROPS w Krakowie; the label below
 * paraphrases exactly that. Any other link → null.
 */
export const MIIS_LICENCE = "Umowa licencyjna z ROPS Kraków (nieodpłatna, niewyłączna)";
export function licenceFromUrl(href: string): string | null {
  const m = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d+\.\d+)/i.exec(href);
  if (m) return `CC ${m[1]!.toUpperCase()} ${m[2]}`;
  const zero = /creativecommons\.org\/publicdomain\/zero\/(\d+\.\d+)/i.exec(href);
  if (zero) return `CC0 ${zero[1]}`;
  if (/\/Zasady_wykorzystania_innowacji_MIIS\.pdf$/i.test(href)) return MIIS_LICENCE;
  return null;
}

type Buttons = {
  videoUrl: string | null;
  folderUrl: string | null;
  materialsUrl: string | null;
  licence: string | null;
  licenceUrl: string | null;
  rawVideoHref: string | null;
};

function parseButtons($: cheerio.CheerioAPI, root: cheerio.Cheerio<Element>, pageUrl: string): Buttons {
  const out: Buttons = { videoUrl: null, folderUrl: null, materialsUrl: null, licence: null, licenceUrl: null, rawVideoHref: null };
  const abs = (h: string) => {
    try {
      return new URL(h.trim(), pageUrl).href;
    } catch {
      return null;
    }
  };
  root.find("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    if (rows.length < 2) return;
    // Row 2 carries the captions; row 1 the icons, offset by one rowspan cell.
    const captions = $(rows[1]!)
      .children("td")
      .toArray()
      .map((td) => normaliseLine($(td).text()).toLowerCase());
    const iconCells = $(rows[0]!).children("td").toArray();
    const offset = iconCells.length - captions.length;
    captions.forEach((caption, i) => {
      const cell = iconCells[i + offset];
      if (!cell) return;
      const href = $(cell).find("a[href]").first().attr("href");
      if (!href) return;
      const url = abs(href);
      if (!url) return;
      if (/dowiedz/.test(caption)) out.folderUrl ??= url;
      else if (/film/.test(caption)) {
        out.rawVideoHref ??= url;
        out.videoUrl ??= canonicalYouTube(url);
      } else if (/pobierz|materia/.test(caption)) out.materialsUrl ??= url;
      else if (/zasady|licencj/.test(caption)) {
        out.licenceUrl ??= url;
        out.licence ??= licenceFromUrl(url);
      }
    });
  });
  return out;
}

// ------------------------------------------------------------------ sentences

/**
 * Words after which a full stop never ends a sentence. Single capital letters (initials) and
 * one- or two-digit ordinals ("3. edycja") are handled in `isAbbreviation`.
 */
const ABBREVIATIONS = [
  "m.in", "np", "tj", "ok", "ul", "tzw", "r", "zł", "proc", "tzn", "wg", "dr", "prof", "hab", "mgr", "inż",
  "nr", "pkt", "godz", "tys", "mln", "mld", "św", "al", "im", "ang", "pt", "ww", "jw", "ds", "os", "pn", "sp", "z o.o",
  "o.o", "s.c", "s.a", "lek", "med", "dot", "itp.", "red", "rozp", "art", "ust", "poz", "str", "min", "max", "kl", "woj", "pow", "gm",
];

function isAbbreviation(before: string): boolean {
  // `before` is the text up to (not including) the full stop.
  const lastToken = /(\S+)$/.exec(before)?.[1] ?? "";
  const token = lastToken.replace(/^[(„"«'”]+/, "").toLowerCase();
  if (!token) return false;
  if (ABBREVIATIONS.includes(token)) return true;
  if (/^\p{Lu}$/u.test(lastToken.replace(/^[(„"«'”]+/, ""))) return true; // initial: "J. Kowalski"
  if (/^\d{1,2}$/.test(token)) return true; // ordinal or list number: "3. edycja"
  if (/^(\p{L}\.)+\p{L}$/u.test(token)) return true; // "m.in", "p.o"
  return false;
}

const BULLET = /^\s*(?:[-–—•·*▪►■●◦]|\d{1,2}[.)](?=\s))\s*/;

/** Split one line of text into sentences on . ! ? followed by whitespace and a capital, digit or quote. */
export function splitLine(line: string): string[] {
  const out: string[] = [];
  const text = line.replace(BULLET, "");
  // Inline bullets: "a • b • c"
  const pieces = text.split(/\s+[•·▪►■●]\s+/);
  for (const piece of pieces) {
    let start = 0;
    const re = /[.!?…]+["”»)]?(?=\s+["„“«(]?[\p{Lu}\d])/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece))) {
      const end = m.index + m[0].length;
      if (m[0].startsWith(".") && m[0].length === 1 && isAbbreviation(piece.slice(start, m.index))) continue;
      const s = piece.slice(start, end).trim();
      if (s) out.push(s);
      start = end;
    }
    const rest = piece.slice(start).trim();
    if (rest) out.push(rest);
  }
  return out.filter((s) => /[\p{L}\d]/u.test(s));
}

/**
 * Lines are sentence boundaries, except a <br> that falls mid-sentence: when a line ends without
 * punctuation and the next starts in lower case and is not a bullet („koszty<br>eksploatacyjne"),
 * the two are one sentence.
 */
function joinBrokenLines(text: string): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    let prevInPara = false;
    for (const line of para.split("\n")) {
      const prev = lines[lines.length - 1];
      if (prevInPara && prev !== undefined && !/[.!?:;…]$/.test(prev) && /^\p{Ll}/u.test(line) && !BULLET.test(line)) {
        lines[lines.length - 1] = `${prev} ${line}`;
      } else lines.push(line);
      prevInPara = true;
    }
  }
  return lines;
}

export function splitSentences(sectionText: string): string[] {
  return joinBrokenLines(sectionText)
    .flatMap(splitLine)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------------ mapa areas

/**
 * Rule (documented): a card's areas come from its library categories via CATEGORY_TO_AREA.
 * `mental_health` is added on top when the solution, problems or targetGroup sections contain,
 * at a word start, one of the stems „psychiatr", „depres", „lęk", „samobój", or the phrases
 * „zdrowi… psychiczn…" / „kryzys… psychiczn…". Other sections (whoCanUse, doesItWork, authors)
 * are not read for this, so an institution's name such as „szpital psychiatryczny" in the list
 * of possible users does not make a card a mental-health card.
 */
export const MENTAL_HEALTH_PATTERNS: RegExp[] = [
  /(^|[^\p{L}])psychiatr/iu,
  /(^|[^\p{L}])depres/iu,
  /(^|[^\p{L}])zdrowi\p{L}*\s+psychiczn/iu,
  /(^|[^\p{L}])kryzys\p{L}*\s+psychiczn/iu,
  /(^|[^\p{L}])lęk/iu,
  /(^|[^\p{L}])samobój/iu,
];

export function mapaAreasFor(categories: string[], sections: Record<SectionKey, string>): MapaArea[] {
  const set = new Set<MapaArea>();
  for (const c of categories) {
    const a = CATEGORY_TO_AREA[c as CategorySlug];
    if (a) set.add(a);
  }
  const text = [sections.solution, sections.problems, sections.targetGroup].join("\n");
  if (MENTAL_HEALTH_PATTERNS.some((re) => re.test(text))) set.add("mental_health");
  return AREA_ORDER.filter((a) => set.has(a));
}

// ------------------------------------------------------------------ the card parser

export type ParsedCard = {
  title: string;
  badge: string | null;
  sections: Record<SectionKey, string>;
  rawAuthors: string;
  buttons: Buttons;
  warnings: string[];
};

export class CardParseError extends Error {}

export function parseCardHtml(html: string, pageUrl: string): ParsedCard {
  const $ = cheerio.load(html);
  const titleEl = $("h2.page-title").first();
  const title = normaliseLine(titleEl.text());
  if (!title) throw new CardParseError("brak tytułu (h2.page-title)");
  const content = titleEl.nextAll(".text-content").first();
  if (!content.length) throw new CardParseError("brak treści (.text-content po tytule)");

  const warnings: string[] = [];
  const sections: Record<SectionKey, string[]> = {
    solution: [],
    problems: [],
    targetGroup: [],
    whoCanUse: [],
    doesItWork: [],
    authors: [],
  };
  const seen = new Set<SectionKey>();
  let current: SectionKey | null = null;
  const preamble: string[] = [];

  for (const node of content.contents().toArray()) {
    if (node.type === "tag") {
      const el = node as Element;
      if (el.name === "table") continue; // the button table
      const text = normaliseLine($(el).text());
      if (isHeadingElement($, el)) {
        const key = headingKey(text);
        if (key) {
          if (seen.has(key)) warnings.push(`sekcja „${key}" powtórzona`);
          seen.add(key);
          current = key;
          continue;
        }
      }
      const paras = blockText($, el);
      if (current) sections[current].push(...paras);
      else preamble.push(...paras);
    } else if (node.type === "text") {
      const t = normaliseLine((node as unknown as { data: string }).data);
      if (!t) continue;
      if (current) sections[current].push(t);
      else preamble.push(t);
    }
  }

  const badge = preamble.find((p) => /wybran\p{L}*\s+do\s+upowszechnia/iu.test(p)) ?? null;
  for (const p of preamble) if (p !== badge) warnings.push(`tekst przed sekcjami: „${p.slice(0, 80)}"`);

  const missing = (Object.keys(sections) as SectionKey[]).filter((k) => !seen.has(k));
  if (missing.includes("solution")) throw new CardParseError(`brak sekcji „Na czym polega rozwiązanie?" (brakuje: ${missing.join(", ")})`);
  if (missing.length >= 3) throw new CardParseError(`brak sekcji: ${missing.join(", ")}`);
  for (const k of missing) warnings.push(`brak sekcji „${k}"`);

  const joined = Object.fromEntries(
    (Object.entries(sections) as [SectionKey, string[]][]).map(([k, v]) => [k, v.join("\n\n")]),
  ) as Record<SectionKey, string>;
  for (const k of Object.keys(joined) as SectionKey[]) if (seen.has(k) && !joined[k]) warnings.push(`pusta sekcja „${k}"`);
  if (!joined.solution)
    throw new CardParseError("sekcja „Na czym polega rozwiązanie?\" jest pusta na stronie źródłowej — nie ma czego pokazać jako opisu rozwiązania");

  const buttons = parseButtons($, content, pageUrl);
  if (buttons.rawVideoHref && !buttons.videoUrl) warnings.push(`link „zobacz film" nie jest YouTube: ${buttons.rawVideoHref}`);
  if (buttons.licenceUrl && !buttons.licence) warnings.push(`licencja nierozpoznana: ${buttons.licenceUrl}`);

  const rawAuthors = joined.authors;
  return { title, badge: badge ? normaliseLine(badge.replace(/\n/g, " ")) : null, sections: joined, rawAuthors, buttons, warnings };
}

/** Turn a parsed card into the published record (authors anonymised, sentences numbered). */
export function buildCard(
  id: string,
  slug: string,
  parsed: ParsedCard,
  categories: string[],
  categoryLabels: string[],
  meta: { sourceUrl: string; capturedAt: string; sha256: string },
  warnings: string[] = [],
): LibraryCard {
  const authors = anonymiseAuthors(parsed.rawAuthors);
  for (const a of authors.ambiguous) warnings.push(`autor nierozpoznany (pominięty): „${a}"`);
  const sections: Record<SectionKey, string> = { ...parsed.sections, authors: authors.text };
  const sentences: Sentence[] = [];
  let n = 0;
  for (const key of ["solution", "problems", "targetGroup", "whoCanUse", "doesItWork", "authors"] as SectionKey[]) {
    for (const text of splitSentences(sections[key])) sentences.push({ id: `${id}.s${++n}`, section: key, text });
  }
  return {
    id,
    slug,
    title: parsed.title,
    categories,
    categoryLabels,
    sections,
    sentences,
    badge: parsed.badge,
    videoUrl: parsed.buttons.videoUrl,
    folderUrl: parsed.buttons.folderUrl,
    materialsUrl: parsed.buttons.materialsUrl,
    licence: parsed.buttons.licence,
    licenceUrl: parsed.buttons.licenceUrl,
    mapaAreas: mapaAreasFor(categories, sections),
    keywords: extractKeywords(parsed.title, sections),
    sourceUrl: meta.sourceUrl,
    capturedAt: meta.capturedAt,
    sha256: meta.sha256,
  };
}

// ------------------------------------------------------------------ main

type Listing = { slug: string; url: string; categories: CategorySlug[] };

async function main() {
  const labels = new Map<CategorySlug, string>();
  const bySlug = new Map<string, Listing>();
  const perCategory = new Map<CategorySlug, number>();

  for (const cat of CATEGORIES) {
    const page = await politeFetch(`${LIBRARY_BASE}/${cat}`);
    const $ = cheerio.load(page.body.toString("utf8"));
    labels.set(cat, normaliseLine($("h2.page-title").first().text()));
    let count = 0;
    $("a.news-list__title").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      const url = new URL(href, LIBRARY_BASE).href;
      const m = /\/biblioteka-innowacji-spolecznych\/([^/,]+),([^/?#]+)/.exec(url);
      if (!m) return;
      const slug = decodeURIComponent(m[2]!);
      count++;
      const prior = bySlug.get(slug);
      if (prior) {
        if (!prior.categories.includes(cat)) prior.categories.push(cat);
      } else bySlug.set(slug, { slug, url, categories: [cat] });
    });
    perCategory.set(cat, count);
    if (count === 0) throw new Error(`Kategoria ${cat} nie zwróciła żadnej karty — źródło się zmieniło, przerywam.`);
  }

  // Ids are assigned over EVERY listed slug in code-point order, withheld ones included, so a
  // withheld card that starts parsing later does not renumber the cards after it.
  const listings = [...bySlug.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const cards: LibraryCard[] = [];
  const withheld: z.infer<typeof WithheldCard>[] = [];
  const warnings: string[] = [];

  let seq = 0;
  for (const l of listings) {
    const id = `c${String(++seq).padStart(3, "0")}`;
    const categories = CATEGORIES.filter((c) => l.categories.includes(c));
    const base = { id, url: l.url, slug: l.slug, categories };
    let page;
    try {
      page = await politeFetch(l.url, { allowError: true });
    } catch (e) {
      withheld.push({ ...base, reason: `błąd pobierania: ${(e as Error).message}`, capturedAt: null, sha256: null });
      continue;
    }
    if (page.status !== 200) {
      withheld.push({ ...base, reason: `HTTP ${page.status}`, capturedAt: page.capturedAt, sha256: page.sha256 });
      continue;
    }
    try {
      const parsed = parseCardHtml(page.body.toString("utf8"), l.url);
      const cardWarnings = [...parsed.warnings];
      const card = buildCard(
        id,
        l.slug,
        parsed,
        categories,
        categories.map((c) => labels.get(c)!),
        { sourceUrl: l.url, capturedAt: page.capturedAt, sha256: page.sha256 },
        cardWarnings,
      );
      cards.push(card);
      for (const w of cardWarnings) warnings.push(`${id} ${l.slug}: ${w}`);
    } catch (e) {
      withheld.push({ ...base, reason: (e as Error).message, capturedAt: page.capturedAt, sha256: page.sha256 });
    }
  }

  const lib = Library.parse(cards);
  writeJson("data/library.json", lib);
  writeJson("data/library.withheld.json", LibraryWithheld.parse(withheld));

  // ---- summary
  console.log(`Karty: ${lib.length} unikalnych (z ${[...perCategory.values()].reduce((a, b) => a + b, 0)} wpisów na listach)`);
  console.log("Wpisy na listach kategorii / karty po scaleniu:");
  for (const cat of CATEGORIES) {
    console.log(`  ${cat.padEnd(46)} ${String(perCategory.get(cat)).padStart(3)} / ${lib.filter((c) => c.categories.includes(cat)).length}`);
  }
  const withVideo = lib.filter((c) => c.videoUrl).length;
  console.log(`Z filmem: ${withVideo}, bez filmu: ${lib.length - withVideo}`);
  console.log(`Z folderem PDF: ${lib.filter((c) => c.folderUrl).length}, z materiałami: ${lib.filter((c) => c.materialsUrl).length}, z licencją: ${lib.filter((c) => c.licence).length}`);
  console.log(`mental_health: ${lib.filter((c) => c.mapaAreas.includes("mental_health")).length}`);
  console.log(`Zdania: ${lib.reduce((a, c) => a + c.sentences.length, 0)}`);
  if (withheld.length) {
    console.log(`Wstrzymane (${withheld.length}) → data/library.withheld.json:`);
    for (const w of withheld) console.log(`  ${w.url}  — ${w.reason}`);
  } else console.log("Błędy parsowania: brak");
  if (warnings.length) {
    console.log(`Ostrzeżenia (${warnings.length}):`);
    for (const w of warnings) console.log(`  ${w}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
