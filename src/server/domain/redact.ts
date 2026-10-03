/**
 * Removes personal data from a resident's text before it is stored, logged or
 * sent to a model. Placeholders are Polish, because the text stays Polish.
 *
 * Order matters: e-mail first (its local part may hold digits), then the 26-digit
 * account number (which contains 11- and 9-digit runs), then PESEL, then phone,
 * then street address, then a name after an honorific.
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

export const PII_PLACEHOLDERS: Readonly<Record<PiiKind, string>> = {
  email: "[e-mail]",
  iban: "[numer konta]",
  pesel: "[PESEL]",
  phone: "[telefon]",
  address: "[adres]",
  name: "[osoba]",
};

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

/** Honorific + one or two capitalised name words (Kowalska, Anna Nowak, Nowak-Wiśniewska). */
const NAME_WORD = "\\p{Lu}\\p{Ll}+(?:-\\p{Lu}\\p{Ll}+)?";
const HONORIFIC_NAME = new RegExp(
  `(?<![\\p{L}])([Pp]an(?:a|u|em|ie|i|ią)?)[ \\u00A0]+${NAME_WORD}(?:[ \\u00A0]+${NAME_WORD})?`,
  "gu",
);

type Rule = {
  kind: PiiKind;
  pattern: RegExp;
  /** Return the replacement, or null to leave this match alone. */
  replace: (match: string, groups: string[], offset: number, input: string) => string | null;
};

const RULES: readonly Rule[] = [
  { kind: "email", pattern: EMAIL, replace: () => PII_PLACEHOLDERS.email },
  { kind: "iban", pattern: IBAN, replace: () => PII_PLACEHOLDERS.iban },
  {
    kind: "pesel",
    pattern: PESEL,
    replace: (m) => (isValidPesel(m) ? PII_PLACEHOLDERS.pesel : null),
  },
  {
    kind: "phone",
    pattern: PHONE,
    replace: (m, _g, offset, input) =>
      CURRENCY_AFTER.test(input.slice(offset + m.length)) ? null : PII_PLACEHOLDERS.phone,
  },
  { kind: "address", pattern: ADDRESS, replace: () => PII_PLACEHOLDERS.address },
  {
    kind: "name",
    pattern: HONORIFIC_NAME,
    replace: (_m, groups) => `${groups[0] ?? "Pani"} ${PII_PLACEHOLDERS.name}`,
  },
];

export function redactPII(text: string): RedactionResult {
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
      const replacement = rule.replace(match, groups, offset, input);
      if (replacement === null) return match;
      count++;
      return replacement;
    });
    if (count > 0) found.push({ kind: rule.kind, count });
  }
  return { text: out, found };
}
