import { fold, foldWithMap } from "./format";

/**
 * Finds where `terms` occur in `text`, ignoring case and Polish diacritics
 * („mieszka sama" matches „Mieszka SAMA", „zlobek" matches „żłobek").
 * A match must start at a word boundary and is extended to the end of that
 * word, so a stem („samotn") marks all of „samotnie". Overlapping ranges
 * are merged.
 * Returns [start, end) index pairs into the original `text`.
 */
export function findTermRanges(
  text: string,
  terms: readonly string[],
): [number, number][] {
  const { folded, map } = foldWithMap(text);
  const needles = [
    ...new Set(terms.map((t) => fold(t.trim())).filter((t) => t.length >= 2)),
  ];
  const ranges: [number, number][] = [];
  for (const n of needles) {
    let from = 0;
    while (from <= folded.length - n.length) {
      const at = folded.indexOf(n, from);
      if (at < 0) break;
      const prev = at > 0 ? folded[at - 1]! : "";
      if (!prev || !/[\p{L}\p{N}]/u.test(prev)) {
        // Extend to the end of the word, so a stem marks the whole word.
        let stop = at + n.length;
        while (stop < folded.length && /[\p{L}\p{N}]/u.test(folded[stop]!))
          stop++;
        const start = map[at]!;
        const end = map[stop - 1]! + 1;
        ranges.push([start, end]);
      }
      from = at + 1;
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
