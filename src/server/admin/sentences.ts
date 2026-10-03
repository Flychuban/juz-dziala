/**
 * Sentence splitting for library cards — the same rules as the ingest
 * (`scripts/ingest-library.ts` → `splitSentences`), copied here so the app
 * does not bundle the scraper (cheerio). `sentences.test.ts` asserts that both
 * produce identical output for every section of data/library.json.
 *
 * Pure: no database, no Next.js.
 */
import { SECTION_KEYS, type SectionKey } from "~/lib/domain";

export type CardSentence = { id: string; section: SectionKey; text: string };

/**
 * Words after which a full stop never ends a sentence. Single capital letters
 * (initials) and one- or two-digit ordinals („3. edycja") are handled in
 * `isAbbreviation`.
 */
const ABBREVIATIONS = [
  "m.in", "np", "tj", "ok", "ul", "tzw", "r", "zł", "proc", "tzn", "wg", "dr", "prof", "hab", "mgr", "inż",
  "nr", "pkt", "godz", "tys", "mln", "mld", "św", "al", "im", "ang", "pt", "ww", "jw", "ds", "os", "pn", "sp", "z o.o",
  "o.o", "s.c", "s.a", "lek", "med", "dot", "itp.", "red", "rozp", "art", "ust", "poz", "str", "min", "max", "kl", "woj", "pow", "gm",
]; // prettier-ignore

function isAbbreviation(before: string): boolean {
  const lastToken = /(\S+)$/.exec(before)?.[1] ?? "";
  const token = lastToken.replace(/^[(„"«'”]+/, "").toLowerCase();
  if (!token) return false;
  if (ABBREVIATIONS.includes(token)) return true;
  if (/^\p{Lu}$/u.test(lastToken.replace(/^[(„"«'”]+/, ""))) return true;
  if (/^\d{1,2}$/.test(token)) return true;
  if (/^(\p{L}\.)+\p{L}$/u.test(token)) return true;
  return false;
}

const BULLET = /^\s*(?:[-–—•·*▪►■●◦]|\d{1,2}[.)](?=\s))\s*/;

/** One line → sentences on . ! ? followed by whitespace and a capital, digit or quote. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  const text = line.replace(BULLET, "");
  const pieces = text.split(/\s+[•·▪►■●]\s+/);
  for (const piece of pieces) {
    let start = 0;
    const re = /[.!?…]+["”»)]?(?=\s+["„“«(]?[\p{Lu}\d])/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece))) {
      const end = m.index + m[0].length;
      if (
        m[0].startsWith(".") &&
        m[0].length === 1 &&
        isAbbreviation(piece.slice(start, m.index))
      )
        continue;
      const s = piece.slice(start, end).trim();
      if (s) out.push(s);
      start = end;
    }
    const rest = piece.slice(start).trim();
    if (rest) out.push(rest);
  }
  return out.filter((s) => /[\p{L}\d]/u.test(s));
}

/** Lines are boundaries, except a line break that falls mid-sentence. */
function joinBrokenLines(text: string): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    let prevInPara = false;
    for (const line of para.split("\n")) {
      const prev = lines[lines.length - 1];
      if (
        prevInPara &&
        prev !== undefined &&
        !/[.!?:;…]$/.test(prev) &&
        /^\p{Ll}/u.test(line) &&
        !BULLET.test(line)
      ) {
        lines[lines.length - 1] = `${prev} ${line}`;
      } else lines.push(line);
      prevInPara = true;
    }
  }
  return lines;
}

/** Splits one section into sentences (identical to the ingest). */
export function splitSentences(sectionText: string): string[] {
  return joinBrokenLines(sectionText)
    .flatMap(splitLine)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type SentenceDiff = {
  sentences: CardSentence[];
  kept: number;
  added: string[];
  removed: string[];
};

/**
 * Re-derives a card's sentences after an edit. A sentence whose section and
 * text are unchanged keeps its id (so earlier AI citations still resolve);
 * every new or changed sentence gets a fresh id after the highest existing
 * number („c042.s17" → „c042.s18"). Ids are never reused.
 */
export function rederiveSentences(
  cardId: string,
  previous: readonly CardSentence[],
  sections: Record<SectionKey, string>,
): SentenceDiff {
  const pool = new Map<string, CardSentence[]>();
  let maxN = 0;
  for (const s of previous) {
    const key = `${s.section}\u0000${s.text}`;
    pool.set(key, [...(pool.get(key) ?? []), s]);
    const n = Number(/\.s(\d+)$/.exec(s.id)?.[1] ?? 0);
    if (n > maxN) maxN = n;
  }
  const sentences: CardSentence[] = [];
  const added: string[] = [];
  let kept = 0;
  for (const section of SECTION_KEYS) {
    for (const text of splitSentences(sections[section] ?? "")) {
      const key = `${section}\u0000${text}`;
      const reuse = pool.get(key)?.shift();
      if (reuse) {
        sentences.push(reuse);
        kept++;
      } else {
        const id = `${cardId}.s${++maxN}`;
        sentences.push({ id, section, text });
        added.push(id);
      }
    }
  }
  const removed = [...pool.values()].flat().map((s) => s.id);
  return { sentences, kept, added, removed };
}
