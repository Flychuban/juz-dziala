/**
 * The triage JSON as the staff screens read it: the shared `CaseTriage`
 * (src/server/cases/types.ts) plus optional fields added later. Every new
 * field is optional, so rows written before it existed keep working.
 * Client-safe (types and pure helpers only).
 */
import type { CaseTriage, TriageCard } from "~/server/cases/types";

export type StaffTriageCard = TriageCard & {
  /** English title and quoted sentence (innovations.en), when translated. */
  titleEn?: string | null;
  sentenceEn?: string | null;
};

export type StaffTriage = Omit<CaseTriage, "cards"> & {
  /** The summary in English, for staff who use the panel in English. */
  summaryEn?: string | null;
  /** Language of `replyDraft` (the case author's language). */
  draftLocale?: "pl" | "en";
  /** Written by the sample-cases seed, not by a model run. */
  sample?: boolean;
  cards: StaffTriageCard[];
};

/** The summary in the viewer's language; Polish when no English one exists. */
export function triageSummary(
  t: Pick<StaffTriage, "summary" | "summaryEn"> | null | undefined,
  locale: string,
): { text: string; lang: "pl" | "en" } | null {
  if (!t) return null;
  if (locale === "en" && t.summaryEn) return { text: t.summaryEn, lang: "en" };
  return t.summary ? { text: t.summary, lang: "pl" } : null;
}
