/**
 * TEMPORARY stand-in for Agent A0's pure domain functions
 * (`src/server/domain/redact.ts`, `src/server/domain/case-code.ts`).
 * Same signatures; deleted as soon as `main` carries the real ones.
 */
import { createHash, randomBytes, randomInt } from "node:crypto";

/** Crockford-like alphabet: no 0/O, 1/I/L, U. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateCaseCode(): string {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `JD-${block()}-${block()}`;
}

export function normalizeCaseCode(s: string): string | null {
  const raw = s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  const body = raw.startsWith("JD") && raw.length === 10 ? raw.slice(2) : raw;
  if (body.length !== 8) return null;
  if ([...body].some((c) => !ALPHABET.includes(c))) return null;
  return `JD-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

export function maskContact(s: string): string {
  const v = s.trim();
  const at = v.indexOf("@");
  if (at > 0) {
    const [user, domain] = [v.slice(0, at), v.slice(at + 1)];
    const dot = domain.lastIndexOf(".");
    const host = dot > 0 ? domain.slice(0, dot) : domain;
    const tld = dot > 0 ? domain.slice(dot) : "";
    return `${user.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 6) return `*** *** ${digits.slice(-3)}`;
  return "***";
}

export function redactPII(text: string): { text: string; found: string[] } {
  const found: string[] = [];
  const rules: [RegExp, string, string][] = [
    [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu, "[e-mail]", "email"],
    [/\b\d{11}\b/g, "[PESEL]", "pesel"],
    [/(?:\+?48[\s-]?)?(?:\d[\s-]?){9}\b/g, "[telefon]", "phone"],
  ];
  let out = text;
  for (const [re, repl, kind] of rules) {
    out = out.replace(re, () => {
      found.push(kind);
      return repl;
    });
  }
  return { text: out, found };
}
