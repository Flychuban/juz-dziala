/**
 * Pure rules of the duplicate check (unit-tested). „Podobne rozwiązania już
 * istnieją" is a strong claim to make to someone with a new idea, so it rests
 * on how much of the idea's own wording a card shares, not on the raw keyword
 * score (which grows with the length of the text and saturates).
 *
 * Calibrated 2026-10-03 on ten hand-written fiszki against data/library.json:
 * five paraphrases of existing cards (Bawita, modular bathrooms, the fencing
 * wheelchair, QR codes for seniors, Głucha ankieta) were all found; five new
 * ideas (an urban apiary, village ride-sharing, a repair café, a school
 * garden, a social fridge) produced no claim.
 */

/** A card sharing at least this share of the idea's words is „podobne". */
export const SIMILAR_COVERAGE = 0.6;
/** …and at least this many of them, so a three-word idea cannot match everything. */
export const SIMILAR_MIN_WORDS = 4;
/** A lone top hit counts when it clearly leads the second one and shares this much. */
export const SIMILAR_LEAD_RATIO = 1.6;
export const SIMILAR_LEAD_COVERAGE = 0.4;
export const SIMILAR_LEAD_MIN_WORDS = 3;

/** Author lines that stand for private persons (anonymised at ingest). */
export const PRIVATE_AUTHORS = /osoby prywatne/i;

export type ScoredHit = { score: number; matchedWords: number };

export function coverageOf(hit: ScoredHit, userWords: number): number {
  return userWords > 0 ? hit.matchedWords / userWords : 0;
}

export function pickSimilar<T extends ScoredHit>(hits: readonly T[], userWords: number, limit = 3): T[] {
  if (hits.length === 0 || userWords <= 0) return [];
  const strong = hits
    .filter((h) => coverageOf(h, userWords) >= SIMILAR_COVERAGE && h.matchedWords >= SIMILAR_MIN_WORDS)
    .sort((a, b) => b.matchedWords - a.matchedWords || b.score - a.score);
  if (strong.length > 0) return strong.slice(0, limit);

  const byScore = [...hits].sort((a, b) => b.score - a.score);
  const top = byScore[0]!;
  const second = byScore[1]?.score ?? 0;
  if (
    top.matchedWords >= SIMILAR_LEAD_MIN_WORDS &&
    coverageOf(top, userWords) >= SIMILAR_LEAD_COVERAGE &&
    top.score >= SIMILAR_LEAD_RATIO * second
  ) {
    return [top];
  }
  return [];
}
