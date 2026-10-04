/**
 * Pure, client-safe rules of the application generator (unit-tested):
 *  - `draftToFields` — the streamed Markdown back into one value per field;
 *  - `unverifiedNumbers` — numbers in the draft that the author never wrote;
 *  - `DRAFT_FAILED_MARKER` / `splitFailure` — how the route tells the page that
 *    the assistant stopped mid-way (so a broken draft is never filled in).
 * The AI-free template lives in ./application-template.ts (server).
 */
import { GAP, GAP_EN, type ApplicationField } from "./schema";

export type FormFieldDef = { key: string; label: string; hint: string | null };

/**
 * Written by /api/ideas/application in place of the assistant's failure line
 * (AI_STREAM_LINES) — a control-character marker no draft can contain.
 */
export const DRAFT_FAILED_MARKER = "\u001eJD:DRAFT_FAILED\u001e";

/** The draft text without the failure marker, and whether it was there. */
export function splitFailure(text: string): { text: string; failed: boolean } {
  const i = text.indexOf(DRAFT_FAILED_MARKER);
  return i < 0 ? { text, failed: false } : { text: text.slice(0, i).trimEnd(), failed: true };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„”"*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Splits the Markdown draft on „## " headings and assigns each block to the
 * field whose label it names (exact, then prefix match). Fields the draft did
 * not answer get the gap marker, so nothing is silently dropped.
 */
export function draftToFields(markdown: string, fields: readonly FormFieldDef[], gap: string = GAP): ApplicationField[] {
  const blocks = new Map<string, string>();
  const parts = markdown.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = norm(nl < 0 ? part : part.slice(0, nl)).replace(/^\d+[.)]\s*/, "");
    const body = (nl < 0 ? "" : part.slice(nl + 1)).trim();
    const field =
      fields.find((f) => norm(f.label) === heading) ??
      fields.find((f) => heading.startsWith(norm(f.label)) || norm(f.label).startsWith(heading));
    if (field && !blocks.has(field.key)) blocks.set(field.key, body);
  }
  return fields.map((f) => {
    const value = blocks.get(f.key)?.trim();
    return { key: f.key, label: f.label, value: value?.length ? value : gap };
  });
}

export function fieldsToMarkdown(fields: readonly ApplicationField[]): string {
  return fields.map((f) => `## ${f.label}\n\n${f.value.trim()}`).join("\n\n");
}

/** Fields that are empty or still hold a gap marker (Polish or English). */
export function countGaps(fields: readonly ApplicationField[]): number {
  return fields.filter((f) => !f.value.trim() || f.value.includes(GAP) || f.value.includes(GAP_EN)).length;
}

const NUMBER = /\d+(?:[  .,]\d+)*/g;
const canonical = (n: string) => n.replace(/[  ]/g, "").replace(/[.,]$/, "");

/**
 * Numbers in the draft that appear nowhere in what the author wrote (fiszka,
 * canvas) or in the call's own form text. Shown as „do weryfikacji" — the
 * prompt forbids inventing them, this checks it.
 */
export function unverifiedNumbers(draft: string, sources: readonly string[]): string[] {
  const known = new Set<string>();
  for (const s of sources) for (const m of s.match(NUMBER) ?? []) known.add(canonical(m));
  const out: string[] = [];
  for (const m of draft.match(NUMBER) ?? []) {
    const c = canonical(m);
    if (!known.has(c) && !out.includes(c)) out.push(c);
  }
  return out;
}
