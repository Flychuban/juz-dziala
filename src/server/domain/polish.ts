/**
 * Text normalisation for Polish.
 *
 * Never use `\b` or `\w` on Polish text: both are ASCII-only in JavaScript, even
 * under the `u` flag, so "ł" or "ż" would end a "word". Every pattern here uses
 * the Unicode property classes `\p{L}` (letters), `\p{M}` (combining marks) and
 * `\p{N}` (digits).
 */

const SINGLE_QUOTES = /[‘’‚‛′`´]/g;
const DOUBLE_QUOTES = /[“”„‟«»″〝〞]/g;
const DASHES = /[‐‑‒–—―−﹘﹣－]/g;
/** Soft hyphen, zero-width space/joiners, word joiner, BOM. */
const INVISIBLE = /[­​‌‍⁠﻿]/g;

/** Lowercase, NFC, one kind of quote and dash, single spaces, trimmed. */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .toLowerCase()
    .normalize("NFC")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

const PL_FOLD: Readonly<Record<string, string>> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "A",
  Ć: "C",
  Ę: "E",
  Ł: "L",
  Ń: "N",
  Ó: "O",
  Ś: "S",
  Ź: "Z",
  Ż: "Z",
};

/**
 * Replaces the nine Polish diacritic letters (both cases) one character for one
 * character, so offsets in the result equal offsets in the input. Only Polish
 * letters: a blanket NFD strip would also turn Ukrainian "й" into "и".
 * Expects NFC input.
 */
export function stripPolishDiacritics(s: string): string {
  return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => PL_FOLD[c] ?? c);
}

/** `normalize`, then strip Polish diacritics (ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ź/ż→z). */
export function fold(s: string): string {
  return stripPolishDiacritics(normalize(s));
}

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/** Normalised (lowercase, diacritics kept) words. Hyphens and slashes split words. */
export function tokenize(s: string): string[] {
  return normalize(s).match(WORD) ?? [];
}

export type Token = {
  /** The word exactly as typed (NFC). */
  text: string;
  /** Lowercase NFC form. */
  norm: string;
  /** Lowercase, Polish diacritics stripped. */
  folded: string;
  /** Offsets into `input.normalize("NFC")`. */
  start: number;
  end: number;
};

/** Like `tokenize`, but keeps each word's original spelling and position. */
export function tokenizeWithOffsets(s: string): Token[] {
  const text = s.normalize("NFC");
  const out: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    const word = m[0];
    const norm = word.toLowerCase().normalize("NFC");
    out.push({
      text: word,
      norm,
      folded: stripPolishDiacritics(norm),
      start: m.index,
      end: m.index + word.length,
    });
  }
  return out;
}

/**
 * A small Polish stopword list, stored folded. Deliberately excludes words that
 * carry meaning for matching ("sam", "sama", "nikt", "bez").
 * "nie" is a stopword for retrieval only; phrase matching never drops it.
 */
const STOPWORD_LIST = [
  "a", "aby", "ach", "ale", "albo", "ani", "az", "bardzo",
  "bo", "by", "byc", "byl", "byla", "bylo", "byly", "bym", "bys", "chce",
  "chcialabym", "chcialbym", "ci", "cie", "co", "czy", "dla", "do", "dzien", "dobry",
  "gdy", "gdzie", "go", "i", "ich", "ile", "im", "ja", "jak", "jakis",
  "jakie", "jaki", "jakiej", "jako", "je", "jego", "jej", "jemu", "jest", "jestem",
  "jestesmy", "jeszcze", "jesli", "juz", "kiedy", "ktora", "ktore", "ktorego", "ktorej", "ktory",
  "ktorych", "ktorym", "ktorzy", "ma", "mam", "mamy", "mi", "mial", "miala", "mna",
  "mnie", "moge", "moj", "moja", "moje", "mojego", "mojej", "moze", "mozna", "my",
  "na", "nad", "nam", "nas", "nasz", "nasza", "nasze", "naszej", "nie", "niech",
  "nich", "nim", "nia", "no", "o", "od", "oraz", "on", "ona", "one",
  "oni", "ono", "po", "pod", "pomiedzy", "przez", "przy", "prosze", "sa", "se",
  "sie", "sobie", "soba", "swoj", "swoja", "swoje", "ta", "tak", "takze", "tam",
  "te", "tego", "tej", "ten", "to", "tez", "tu", "ty", "tylko", "tym",
  "tych", "u", "w", "wam", "was", "we", "wiec", "wszystko", "wy", "z",
  "za", "ze", "zeby", "zas",
  // function words that otherwise prefix-match card words ("prawie" → "prawnej", "przed" → "przedmiotów")
  "prawie", "przed", "poprzez", "ciagle", "zawsze", "teraz", "coraz", "wiecej", "bardziej",
  "troche", "dopiero", "nawet", "potem", "wtedy", "kazdy", "kazda", "kazde", "bylam", "bylem",
];
const STOPWORDS: ReadonlySet<string> = new Set(STOPWORD_LIST);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(fold(word));
}

/**
 * Common Polish inflectional endings, folded, longest first. Stripped before the
 * length cap so that "samotna", "samotnie" and "samotność" meet at "samotn".
 */
const SUFFIXES = [
  "osciami", "osciach", "osciom", "oscia", "osci", "osc",
  "iego", "iemu", "iami", "iach",
  "ami", "ach", "iom", "owie", "owi", "ego", "emu", "ymi", "imi", "ych", "ich", "iem",
  "ow", "om", "em", "ym", "im", "ej", "ie", "ia", "iu", "ii", "mi",
  "y", "i", "a", "e", "o", "u",
] as const;

const MIN_STEM = 4;
const MAX_STEM = 7;

/**
 * A crude, deterministic prefix stemmer: fold; leave words of four characters or
 * fewer alone; turn a masculine-personal plural "-orzy" back into "-or"
 * (seniorzy → senior); otherwise strip the longest known ending that still
 * leaves four characters, or else drop the fleeting "e" of a final "-ek"
 * (wózek → wózk-, like wózka); cap the result at seven characters.
 *
 * The brief's literal rule (first max(4, len−3) chars, capped at 7) gives
 * "samotna" → "samo" but "samotność" → "samotn", and "senior" → "seni" but
 * "seniorów" → "senio", so it cannot satisfy its own required test cases.
 * Stripping a known ending first is what makes those families meet. The cap of
 * seven (not six) keeps "przemoc" apart from "przemoknięta".
 */
export function stem(word: string): string {
  const w = (fold(word).match(WORD) ?? []).join("");
  if (w.length <= MIN_STEM) return w;
  let base = w;
  if (w.endsWith("orzy") && w.length - 2 >= MIN_STEM) return w.slice(0, -2).slice(0, MAX_STEM);
  for (const suffix of SUFFIXES) {
    if (w.endsWith(suffix) && w.length - suffix.length >= MIN_STEM) {
      base = w.slice(0, w.length - suffix.length);
      break;
    }
  }
  if (base === w && w.endsWith("ek") && w.length - 1 >= MIN_STEM) {
    base = `${w.slice(0, -2)}k`;
  }
  return base.slice(0, MAX_STEM);
}
