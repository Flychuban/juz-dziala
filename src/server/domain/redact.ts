/**
 * Removes personal data from a resident's text before it is stored, logged or
 * sent to a model. Every rule runs in both languages (a Polish address in an
 * English text is still an address); only the placeholders follow the
 * language the person writes in: „[telefon]" in Polish, "[phone]" in English.
 *
 * Order matters: e-mail first (its local part may hold digits), then the 26-digit
 * account number (which contains 11- and 9-digit runs), then PESEL, then phone,
 * then street address (Polish, then English), then a name after an honorific or
 * after „nazywam się" / "my name is".
 *
 * Deliberately NOT redacted: years, ages ("73 lata"), money amounts and postal
 * codes on their own. Over-redaction there would destroy the meaning of a story
 * without protecting anybody.
 */

export type PiiKind = "email" | "iban" | "pesel" | "phone" | "address" | "name";

export type RedactionResult = {
  text: string;
  found: { kind: PiiKind; count: number }[];
};

export type RedactLocale = "pl" | "en";

export const PII_PLACEHOLDERS: Readonly<Record<PiiKind, string>> = {
  email: "[e-mail]",
  iban: "[numer konta]",
  pesel: "[PESEL]",
  phone: "[telefon]",
  address: "[adres]",
  name: "[osoba]",
};

export const PII_PLACEHOLDERS_EN: Readonly<Record<PiiKind, string>> = {
  email: "[email]",
  iban: "[account number]",
  pesel: "[PESEL]",
  phone: "[phone]",
  address: "[address]",
  name: "[person]",
};

const PLACEHOLDERS_BY_LOCALE: Readonly<Record<RedactLocale, Readonly<Record<PiiKind, string>>>> = {
  pl: PII_PLACEHOLDERS,
  en: PII_PLACEHOLDERS_EN,
};

/** Every placeholder in either language, longest first (for stripping them from matcher input). */
export const ALL_PII_PLACEHOLDERS: readonly string[] = [
  ...new Set([...Object.values(PII_PLACEHOLDERS), ...Object.values(PII_PLACEHOLDERS_EN)]),
].sort((a, b) => b.length - a.length);

const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3] as const;

/** True when `digits` is 11 digits whose last digit is the PESEL check digit. */
export function isValidPesel(digits: string): boolean {
  if (!/^[0-9]{11}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * PESEL_WEIGHTS[i]!;
  return (10 - (sum % 10)) % 10 === Number(digits[10]);
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

/** Optional "PL", then 26 digits with optional single spaces between them. */
const IBAN = /(?<![\p{L}\p{N}])(?:PL[ \u00A0]?)?[0-9](?:[ \u00A0]?[0-9]){25}(?![\p{N}])/giu;

const PESEL = /(?<![\p{N}])[0-9]{11}(?![\p{N}])/gu;

/**
 * Polish phone numbers: optional +48 / 0048 / (+48), then nine digits as 3-3-3,
 * 3-2-2-2 (a common way to write a mobile), 2-3-2-2 (landline, optionally
 * "(12)") or contiguous. Separators: space or hyphen. Helplines written 3-2-4
 * ("800 70 2222") are public numbers and are deliberately not matched.
 */
const PHONE =
  /(?<![\p{N}+])(?:(?:\(?\+48\)?|0048)[ \u00A0-]?)?(?:[0-9]{3}[ \u00A0-]?[0-9]{3}[ \u00A0-]?[0-9]{3}|[0-9]{3}[ \u00A0-][0-9]{2}[ \u00A0-][0-9]{2}[ \u00A0-][0-9]{2}|\(?[0-9]{2}\)?[ \u00A0-]?[0-9]{3}[ \u00A0-]?[0-9]{2}[ \u00A0-]?[0-9]{2})(?![\p{N}])/gu;

/** A nine-digit run followed by a currency is an amount, not a phone number. */
const CURRENCY_AFTER = /^[ \u00A0]?(?:zł|zl(?!\p{L})|złot|zlot|pln|eur|€|usd|\$|gr(?!\p{L}))/iu;

/**
 * Street prefix, a capitalised street name of up to five words (Roman numerals,
 * "3 Maja"-style day numbers and short particles allowed), then a house number
 * with an optional letter and an optional "/flat" or "m. flat".
 */
const STREET_PREFIX =
  "(?:[Uu]l\\.?|[Aa]l\\.|[Oo]s\\.?|[Pp]l\\.|[Uu]lic[aęyą]|[Aa]lej[aęi]|[Aa]lei|[Oo]siedl[eu]|[Pp]lac(?:u|em)?)";
const STREET_WORD = "(?:\\p{Lu}[\\p{L}.'-]*|[IVX]+|[0-9]{1,2}|im\\.|św\\.|ks\\.|gen\\.|al\\.|de|von|i)";
const HOUSE_NO = "[0-9]{1,4}[\\p{L}]?(?:[ \\u00A0]?/[ \\u00A0]?[0-9]{1,4}[\\p{L}]?|[ \\u00A0]+m\\.?[ \\u00A0]?[0-9]{1,4}|[ \\u00A0]+lok\\.?[ \\u00A0]?[0-9]{1,4})?";
const ADDRESS = new RegExp(
  `(?<![\\p{L}])${STREET_PREFIX}[ \\u00A0]+(?:[0-9]{1,2}[ \\u00A0]+)?\\p{Lu}[\\p{L}.'-]*(?:[ \\u00A0]+${STREET_WORD}){0,4}?[ \\u00A0]+${HOUSE_NO}(?![\\p{N}])`,
  "gu",
);

/**
 * An English street address: a house number (optionally after "Flat 3,"), one
 * to four capitalised words, then a street type: "12 Baker Street",
 * "Flat 2, 7 Long Lane", "221B Old Mill Road".
 */
const STREET_TYPE_EN =
  "(?:Street|St\\.?|Road|Rd\\.?|Avenue|Ave\\.?|Lane|Ln\\.?|Close|Drive|Way|Place|Court|Ct\\.?|Crescent|Gardens|Terrace|Square|Grove|Row|Walk|Mews|Parade|Boulevard|Hill)";
const ADDRESS_EN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:(?:[Ff]lat|[Aa]partment|[Aa]pt\\.?)[ \\u00A0]+[0-9]{1,4}[\\p{L}]?,?[ \\u00A0]+)?[0-9]{1,4}[\\p{L}]?,?[ \\u00A0]+(?:\\p{Lu}[\\p{L}'-]*[ \\u00A0]+){1,4}${STREET_TYPE_EN}(?![\\p{L}])`,
  "gu",
);

/** Honorific + one or two capitalised name words (Kowalska, Anna Nowak, Nowak-Wiśniewska). */
const NAME_WORD = "\\p{Lu}\\p{Ll}+(?:-\\p{Lu}\\p{Ll}+)?";
const HONORIFIC_NAME = new RegExp(
  `(?<![\\p{L}])([Pp]an(?:a|u|em|ie|i|ią)?)[ \\u00A0]+${NAME_WORD}(?:[ \\u00A0]+${NAME_WORD})?`,
  "gu",
);
/** Mr / Mrs / Ms / Miss / Mx / Dr (with or without a full stop) + one or two capitalised name words. */
const HONORIFIC_NAME_EN = new RegExp(
  `(?<![\\p{L}])(Mrs|Mr|Ms|Miss|Mx|Dr)(\\.?)[ \\u00A0]+${NAME_WORD}(?:[ \\u00A0]+${NAME_WORD})?`,
  "gu",
);
/** An honorific is not a name: „Nazywam się Pani [osoba]" was already handled by the rule above. */
const HONORIFIC_WORD = "(?:Pan(?:a|u|em|ie|i|ią)?|Mrs|Mr|Ms|Miss|Mx|Dr)";
/** „nazywam się Jan Kowalski", „mam na imię Anna", "my name is John Smith", "I'm called Anna". */
const SELF_NAME = new RegExp(
  `(?<![\\p{L}])((?:[Nn]azywam[ \\u00A0]+się|[Mm]am[ \\u00A0]+na[ \\u00A0]+imię|[Mm]y[ \\u00A0]+name[ \\u00A0]+is|I'm[ \\u00A0]+called|I[ \\u00A0]+am[ \\u00A0]+called))[ \\u00A0]+(?!${HONORIFIC_WORD}(?![\\p{L}]))${NAME_WORD}(?:[ \\u00A0]+${NAME_WORD})?`,
  "gu",
);

type Rule = {
  kind: PiiKind;
  pattern: RegExp;
  /** Return the replacement, or null to leave this match alone. */
  replace: (
    match: string,
    groups: string[],
    offset: number,
    input: string,
    placeholders: Readonly<Record<PiiKind, string>>,
  ) => string | null;
};

const RULES: readonly Rule[] = [
  { kind: "email", pattern: EMAIL, replace: (_m, _g, _o, _i, p) => p.email },
  { kind: "iban", pattern: IBAN, replace: (_m, _g, _o, _i, p) => p.iban },
  {
    kind: "pesel",
    pattern: PESEL,
    replace: (m, _g, _o, _i, p) => (isValidPesel(m) ? p.pesel : null),
  },
  {
    kind: "phone",
    pattern: PHONE,
    replace: (m, _g, offset, input, p) => (CURRENCY_AFTER.test(input.slice(offset + m.length)) ? null : p.phone),
  },
  { kind: "address", pattern: ADDRESS, replace: (_m, _g, _o, _i, p) => p.address },
  { kind: "address", pattern: ADDRESS_EN, replace: (_m, _g, _o, _i, p) => p.address },
  {
    kind: "name",
    pattern: HONORIFIC_NAME,
    replace: (_m, groups, _o, _i, p) => `${groups[0] ?? "Pani"} ${p.name}`,
  },
  {
    kind: "name",
    pattern: HONORIFIC_NAME_EN,
    replace: (_m, groups, _o, _i, p) => `${groups[0] ?? "Mr"}${groups[1] ?? ""} ${p.name}`,
  },
  {
    kind: "name",
    pattern: SELF_NAME,
    replace: (_m, groups, _o, _i, p) => `${groups[0] ?? ""} ${p.name}`,
  },
];

/**
 * @param locale  The language the person writes in; picks the placeholders
 *                („[telefon]" / "[phone]"). Every rule runs in both languages.
 */
export function redactPII(text: string, locale: RedactLocale = "pl"): RedactionResult {
  const placeholders = PLACEHOLDERS_BY_LOCALE[locale];
  let out = text.normalize("NFC");
  const found: { kind: PiiKind; count: number }[] = [];
  for (const rule of RULES) {
    let count = 0;
    out = out.replace(rule.pattern, (...args: unknown[]) => {
      // replace() passes: match, ...groups, offset, input[, namedGroups]
      const match = args[0] as string;
      const offsetIndex = args.findIndex((a, i) => i > 0 && typeof a === "number");
      const groups = args.slice(1, offsetIndex) as string[];
      const offset = args[offsetIndex] as number;
      const input = args[offsetIndex + 1] as string;
      const replacement = rule.replace(match, groups, offset, input, placeholders);
      if (replacement === null) return match;
      count++;
      return replacement;
    });
    if (count > 0) {
      const same = found.find((f) => f.kind === rule.kind);
      if (same) same.count += count;
      else found.push({ kind: rule.kind, count });
    }
  }
  return { text: out, found };
}
