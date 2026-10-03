/** Pure text helpers for „Dodaj z dokumentu" (unit-tested). */

const squash = (s: string) =>
  s
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[„”"«»'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Does the quote occur in the source (ignoring case, diacritics, quotes and spacing)? */
export function quoteFound(quote: string, source: string): boolean {
  const q = squash(quote).replace(/[.…]+$/, "");
  return q.length >= 12 && squash(source).includes(q);
}

/** Plain text of an HTML page (no dependency on a parser; good enough for a draft). */
export function htmlToText(html: string): string {
  return html
    .replace(
      /<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
