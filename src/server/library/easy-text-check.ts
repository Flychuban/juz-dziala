/**
 * Guards for the AI „tekst łatwy" version of a card (pure, unit-tested):
 * it must be short, and it may not contain a number the card does not
 * contain — the cheapest reliable sign of an invented fact.
 */

export const EASY_TEXT_MAX_WORDS = 160;

const numbers = (s: string) =>
  (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));

/** Normalises the model output: one sentence per line, no empty lines, no list markers. */
export function tidyEasyText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .join("\n");
}

/** Returns a reason in Polish when the text should not be shown, else null. */
export function easyTextProblem(text: string, cardText: string): string | null {
  const t = text.trim();
  if (t.length < 40) return "za krótki";
  const words = t.split(/\s+/).length;
  if (words > EASY_TEXT_MAX_WORDS) return "za długi";
  const known = new Set(numbers(cardText));
  const invented = numbers(t).filter((n) => !known.has(n));
  if (invented.length) return `liczby spoza karty: ${invented.join(", ")}`;
  return null;
}
