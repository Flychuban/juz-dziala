/**
 * Case codes a resident can read over the phone, and the secret token that
 * actually grants access to a case. Only the token's hash is ever stored.
 */
import { createHash, randomBytes, randomInt } from "node:crypto";

/** No 0/O, 1/I/L, U: nothing that can be misread or spell a word by accident. */
export const CASE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_LENGTH = 8;
const CODE_PATTERN = /^JD-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;

/** "JD-XXXX-XXXX", eight characters from CASE_CODE_ALPHABET drawn with crypto.randomInt. */
export function generateCaseCode(): string {
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i++) body += CASE_CODE_ALPHABET[randomInt(CASE_CODE_ALPHABET.length)];
  return `JD-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function isCaseCode(s: string): boolean {
  return CODE_PATTERN.test(s);
}

/**
 * Accepts what people actually type: lowercase, spaces, missing or extra dashes,
 * with or without the "JD" prefix. Returns the canonical "JD-XXXX-XXXX", or null
 * when the input cannot be a code. Letters outside the alphabet (O, I, L, U, 0, 1)
 * are rejected, not guessed at.
 */
export function normalizeCaseCode(input: string): string | null {
  const compact = input.normalize("NFKC").toUpperCase().replace(/[\s\-_–—.]/gu, "");
  let body: string;
  if (compact.length === BODY_LENGTH + 2 && compact.startsWith("JD")) body = compact.slice(2);
  else if (compact.length === BODY_LENGTH) body = compact;
  else return null;
  for (const c of body) if (!CASE_CODE_ALPHABET.includes(c)) return null;
  return `JD-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** 32 random bytes, base64url (43 characters). */
export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256 of the token, hex. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Shows enough of a contact to recognise it, not enough to use it:
 * "jan.kowalski@gmail.com" → "j***@g***.com", "+48 600 700 789" → "+48 *** *** 789".
 */
export function maskContact(contact: string): string {
  const s = contact.trim();
  const at = s.lastIndexOf("@");
  if (at > 0 && at < s.length - 1) {
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    const dot = domain.lastIndexOf(".");
    const tld = dot > 0 ? domain.slice(dot) : "";
    const name = dot > 0 ? domain.slice(0, dot) : domain;
    return `${Array.from(local)[0] ?? ""}***@${Array.from(name)[0] ?? ""}***${tld}`;
  }
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length >= 7 && /^[+0-9\s\-().]+$/.test(s)) {
    let national = digits;
    let prefix = "";
    if (s.startsWith("+48") || (digits.startsWith("0048") && digits.length === 13) || (digits.startsWith("48") && digits.length === 11)) {
      national = digits.slice(digits.length - 9);
      prefix = "+48 ";
    } else if (s.startsWith("+")) {
      prefix = "+** ";
      national = digits.slice(-9);
    }
    if (national.length === 9) return `${prefix}*** *** ${national.slice(6)}`;
    return `${prefix}${"*".repeat(Math.max(0, national.length - 3))}${national.slice(-3)}`;
  }
  return s.length === 0 ? "" : `${Array.from(s)[0]}***`;
}
