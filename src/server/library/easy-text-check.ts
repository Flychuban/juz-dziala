/**
 * Guards for the AI „tekst łatwy" version of a card (pure, unit-tested):
 * it must be short, and it may not contain a number the card does not
 * contain — the cheapest reliable sign of an invented fact. The same checks
 * apply to the English version, which is always compared with the Polish card.
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

/**
 * Numbers a card states. Polish groups thousands with a space („1 500"), so
 * the joined form („1500") counts as stated too.
 */
function knownNumbers(cardText: string): Set<string> {
  const joined = cardText.replace(/(\d)[   ](?=\d{3}(?!\d))/g, "$1");
  return new Set([...numbers(cardText), ...numbers(joined)]);
}

/** Returns a reason in Polish when the text should not be shown, else null. */
export function easyTextProblem(
  text: string,
  cardText: string,
  locale = "pl",
): string | null {
  const t = text.trim();
  if (t.length < 40) return "za krótki";
  const words = t.split(/\s+/).length;
  if (words > EASY_TEXT_MAX_WORDS) return "za długi";
  const known = knownNumbers(cardText);
  // English groups thousands with a comma („1,500"); a decimal point stays.
  const own = locale === "en" ? t.replace(/(\d),(?=\d{3}(?!\d))/g, "$1") : t;
  const invented = numbers(own).filter((n) => !known.has(n));
  if (invented.length) return `liczby spoza karty: ${invented.join(", ")}`;
  return null;
}
