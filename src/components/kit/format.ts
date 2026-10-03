/**
 * Polish formatting helpers shared by the kit (client-safe, no React).
 * Dates are formatted in the Europe/Warsaw zone so server and browser agree.
 */

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const NUMBER_FMT = new Intl.NumberFormat("pl-PL");

/** Parses a Date, ISO string or timestamp; returns null when invalid. */
export function toDate(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** „3 października 2026". Returns "" for a missing or invalid date. */
export function formatDatePl(value: Date | string | number | null | undefined) {
  const d = toDate(value);
  return d ? DATE_FMT.format(d) : "";
}

/** ISO date (YYYY-MM-DD) for <time dateTime>. */
export function isoDate(value: Date | string | number | null | undefined) {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : undefined;
}

/** „12 345" — a number in Polish grouping. Strings pass through unchanged. */
export function formatNumberPl(value: number | string) {
  return typeof value === "number" ? NUMBER_FMT.format(value) : value;
}

/**
 * Polish plural form: pluralPl(1, "rozwiązanie", "rozwiązania", "rozwiązań").
 * 1 → one; 2–4 (not 12–14) → few; everything else → many.
 */
export function pluralPl(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** „5 rozwiązań" — the number and its correct Polish plural form. */
export function countPl(n: number, one: string, few: string, many: string) {
  return `${formatNumberPl(n)} ${pluralPl(n, one, few, many)}`;
}

/**
 * Folds text for diacritic-insensitive matching: lower case, Polish
 * diacritics removed (ą→a, ł→l, ż→z …). Returns the folded string and a map
 * from each folded index back to the index in the original string.
 */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const f = foldChar(ch);
    for (const c of f) {
      folded += c;
      map.push(i);
    }
  }
  return { folded, map };
}

/** Diacritic- and case-insensitive form of a string (see foldWithMap). */
export function fold(text: string) {
  let out = "";
  for (const ch of text) out += foldChar(ch);
  return out;
}

function foldChar(ch: string) {
  if (ch === "ł" || ch === "Ł") return "l";
  return ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** „J D myślnik 7 K 3 Q myślnik …" — the code spelled out for screen readers. */
export function spellCode(code: string) {
  return code
    .split("")
    .map((c) => (c === "-" ? "myślnik" : c))
    .join(" ");
}
