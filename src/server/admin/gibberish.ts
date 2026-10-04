/**
 * Recognises test inputs and keyboard noise („asdsadsad", „Szukaj rozwiązań
 * Szukaj rozwiązań", „qwerty") so they never show up in Trendy or as a
 * „biała plama". Pure and client-safe; unit-tested in gibberish.test.ts
 * against every sample need and every library sentence (none may be flagged).
 *
 * Word edges use `\p{L}` (never `\b`, which is ASCII-only and would split a
 * word at „ż" or „ł").
 */

const VOWELS = new Set("aeiouyąęóAEIOUYĄĘÓ".toLowerCase());

/** Rows of a QWERTY keyboard; four neighbouring keys in a row are mashing. */
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const KEYBOARD_RUNS = (() => {
  const runs = new Set<string>();
  for (const row of KEYBOARD_ROWS) {
    const both = [row, [...row].reverse().join("")];
    for (const r of both)
      for (let i = 0; i + 4 <= r.length; i++) runs.add(r.slice(i, i + 4));
  }
  return [...runs];
})();

/** A unit of 2+ letters repeated three times in a row („hahaha", „sdfsdfsdf"). */
const REPEATED_UNIT = /(\p{L}{2,4})\1{2,}/u;

function letters(s: string): string {
  return (s.match(/\p{L}/gu) ?? []).join("").toLowerCase();
}

/** A single word that no one writes on purpose. */
function junkWord(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length >= 5 && ![...w].some((c) => VOWELS.has(c))) return true;
  if (w.length >= 6 && new Set(w).size <= 3) return true;
  if (w.length >= 4 && KEYBOARD_RUNS.some((r) => w.includes(r))) return true;
  return REPEATED_UNIT.test(w);
}

/**
 * True when the text is not a description of a need: almost no letters, the
 * same words over and over, or mostly keyboard noise. Real short needs
 * („Samotność seniora", „Bezdomność") are kept.
 */
export function looksLikeGibberish(text: string): boolean {
  const all = letters(text);
  if (all.length < 4) return true;

  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).map((w) =>
    w.toLowerCase(),
  );
  // „Szukaj rozwiązań Szukaj rozwiązań" — the same words repeated.
  if (words.length >= 3 && new Set(words).size / words.length <= 0.5)
    return true;

  // Mostly vowel-less text (a sentence in any language has ~35–45 % vowels).
  if (all.length >= 12) {
    const vowels = [...all].filter((c) => VOWELS.has(c)).length;
    if (vowels / all.length < 0.2) return true;
  }

  // Keyboard mashing: junk words carry at least half of the letters.
  const letterWords = text.match(/\p{L}+/gu) ?? [];
  const junk = letterWords
    .filter(junkWord)
    .reduce((n, w) => n + w.length, 0);
  return junk / all.length >= 0.5;
}
