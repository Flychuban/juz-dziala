/**
 * Pure helpers of /network (unit-tested, client-safe).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** E-mail lower-cased; phone as digits with an optional leading „+". null when invalid. */
export function normalizeSubscriptionContact(channel: "email" | "sms", raw: string): string | null {
  const s = raw.trim();
  if (channel === "email") return EMAIL_RE.test(s) ? s.toLowerCase() : null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return (s.startsWith("+") ? "+" : "") + digits;
}

/** A short case title from the first sentence of a question. */
export function questionTitle(question: string, max = 90): string {
  const flat = question.replace(/\s+/g, " ").trim();
  const first = /^(.+?[.?!])(\s|$)/.exec(flat)?.[1] ?? flat;
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
