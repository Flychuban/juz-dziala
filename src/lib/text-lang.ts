/**
 * The language of a piece of user-written text (case titles, thread messages,
 * redacted needs), for the `lang` attribute (WCAG 3.1.2): "pl" for Polish,
 * "en" for English, undefined when it can't tell (then it inherits the page).
 * Residents write in either language whatever the page is set to.
 */
const PL_LETTERS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const PL_WORDS = /(^|[\s,.;:!?„"(])(i|w|we|na|nie|się|jest|są|z|ze|do|że|dla|od|po|mam|mama|nasz|nasza|jak|gdzie|czy|bo|ale|oraz|przy|już)(?=$|[\s,.;:!?”")])/i;
const EN_WORDS = /\b(the|and|is|are|my|of|to|for|with|in|we|our|she|he|they|there|no|not|can)\b/i;

export function textLang(text: string | null | undefined): "pl" | "en" | undefined {
  if (!text) return undefined;
  if (PL_LETTERS.test(text)) return "pl";
  const pl = PL_WORDS.test(text);
  const en = EN_WORDS.test(text);
  if (pl && !en) return "pl";
  if (en && !pl) return "en";
  return undefined;
}
