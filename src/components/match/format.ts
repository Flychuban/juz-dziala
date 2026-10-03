/** Formatting helpers usable from server and client components alike (pure, unit-tested). */
import { stripPolishDiacritics } from "~/server/domain/polish";
const DATE_FMT = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

export function formatDatePl(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_FMT.format(d);
}

const PCT = new Intl.NumberFormat("pl-PL", { style: "percent", maximumFractionDigits: 0 });
export function formatPct(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "—" : PCT.format(rate);
}

/** Polish plural: 1 zgłoszenie, 2–4 zgłoszenia, 5+ zgłoszeń (12–14 → zgłoszeń). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

export type GminaOption = { teryt: string; name: string; powiatName: string | null };

export const gminaOptionLabel = (g: GminaOption) => (g.powiatName ? `${g.name} (pow. ${g.powiatName})` : g.name);

/** Resolves what was typed into the gmina field to a TERYT code, or undefined when not unambiguous. */
export function resolveGmina(input: string, options: readonly GminaOption[]): string | undefined {
  const q = input.trim().toLowerCase();
  if (!q) return undefined;
  const exact = options.find((g) => gminaOptionLabel(g).toLowerCase() === q);
  if (exact) return exact.teryt;
  const byName = options.filter((g) => g.name.toLowerCase() === q);
  return byName.length === 1 ? byName[0]!.teryt : undefined;
}

const foldLower = (s: string) => stripPolishDiacritics(s.toLowerCase());

/**
 * [start, end) ranges of every occurrence of `terms` in `text`, case- and
 * diacritic-insensitive, merged where they overlap. Empty when the text's
 * lowercase form changes length (then offsets would not line up).
 */
export function highlightRanges(text: string, terms: readonly string[]): [number, number][] {
  const folded = foldLower(text);
  if (folded.length !== text.length) return [];
  const marks: [number, number][] = [];
  for (const term of terms) {
    const f = foldLower(term.trim());
    if (f.length < 2) continue;
    let from = 0;
    for (;;) {
      const i = folded.indexOf(f, from);
      if (i === -1) break;
      marks.push([i, i + f.length]);
      from = i + f.length;
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const m of marks) {
    const last = merged.at(-1);
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }
  return merged;
}
