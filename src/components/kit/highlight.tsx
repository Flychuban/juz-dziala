import { cn } from "~/lib/utils";
import { findTermRanges } from "./terms";

export { findTermRanges };

/**
 * Highlight — renders `text` with the person's own words marked: a
 * <mark> with a raspberry underline and bold weight, never a yellow fill
 * (yellow is the focus colour). Diacritic- and case-insensitive.
 *
 * @param text   The sentence to show (e.g. a quoted ROPS card sentence).
 * @param terms  The user's words or stems to mark.
 */
export function Highlight({
  text,
  terms,
  className,
}: {
  text: string;
  terms: readonly string[];
  className?: string;
}) {
  const ranges = findTermRanges(text, terms);
  if (ranges.length === 0) return <span className={className}>{text}</span>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([s, e], i) => {
    if (s > cursor) parts.push(text.slice(cursor, s));
    parts.push(
      <mark
        key={i}
        className="decoration-brand-accent text-foreground bg-transparent font-semibold underline decoration-[3px] underline-offset-[0.22em]"
      >
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <span className={cn(className)}>{parts}</span>;
}

/**
 * UserTerms — the person's own words as quiet chips, e.g. under
 * „Pasuje, bo napisałaś/eś:". Each chip is quoted with Polish „…" marks.
 *
 * @param terms  Words or short phrases from the user's description.
 * @param label  Accessible name of the list; defaults to „Twoje słowa".
 */
export function UserTerms({
  terms,
  label = "Twoje słowa",
  className,
}: {
  terms: readonly string[];
  label?: string;
  className?: string;
}) {
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  return (
    <ul
      data-slot="user-terms"
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {unique.map((t) => (
        <li
          key={t}
          className="border-brand-accent bg-background text-foreground inline-flex items-center rounded-sm border px-2.5 py-1 text-base leading-snug font-semibold"
        >
          „{t}”
        </li>
      ))}
    </ul>
  );
}
