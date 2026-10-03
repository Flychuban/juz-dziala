/**
 * The anti-hallucination gate between the AI's answer and the resident's screen.
 *
 * The model proposes matches; nothing it says is shown unless it can be traced:
 * the card must be one we offered it, every quoted sentence must exist on that
 * card (we print OUR text for the id, never the model's), and every highlighted
 * word must actually occur in what the resident wrote.
 */
import { z } from "zod";
import type { KeywordResult } from "./keywords";
import { stem, tokenizeWithOffsets } from "./polish";
import { mapaAreaSchema, type LibraryCard, type MapaArea } from "./types";

export const MAX_MATCHES = 3;
export const MAX_EVIDENCE = 3;
export const MAX_USER_TERMS = 6;
export const MAX_WHY_CHARS = 300;
export const MAX_FIRST_STEP_CHARS = 200;

export const aiMatchSchema = z.object({
  innovationId: z.string(),
  why: z.string(),
  userTerms: z.array(z.string()),
  evidenceSentenceIds: z.array(z.string()),
  firstStep: z.string(),
});

/** What the model must return. Parse its JSON with this before calling finalizeMatches. */
export const aiMatchOutputSchema = z.object({
  matches: z.array(aiMatchSchema),
  abstain: z.boolean(),
  abstainReason: z.string().optional(),
  areas: z.array(mapaAreaSchema),
});
export type AiMatchOutput = z.infer<typeof aiMatchOutputSchema>;

export type VerifiedMatch = {
  card: LibraryCard;
  why: string;
  /** Spans of the resident's own text, as written. */
  userTerms: string[];
  /** Our sentence text for each cited id that exists on this card. */
  evidence: { id: string; text: string }[];
  firstStep: string;
};

export type DropReason = "not_allowed" | "unknown_card" | "duplicate" | "no_evidence" | "over_cap" | "ai_abstained";

export type FinalizedMatches = {
  matches: VerifiedMatch[];
  abstained: boolean;
  /** True when the AI produced nothing usable but the keyword match is confident. */
  fallbackToKeyword: boolean;
  dropped: { innovationId: string; reason: DropReason }[];
};

export type FinalizeContext = {
  userText: string;
  cardsById: ReadonlyMap<string, LibraryCard>;
  allowedCardIds: ReadonlySet<string>;
  keyword: Pick<KeywordResult, "isLowConfidence">;
};

/** Trims, then cuts to at most `max` characters (code points), ending on a word with "…" when cut. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/gu, " ").trim();
  const chars = Array.from(t);
  if (chars.length <= max) return t;
  const cut = chars.slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= Math.floor(max * 0.6) ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.\-–—]+$/u, "")}…`;
}

/** Same word, diacritic- and case-insensitive, tolerating a different ending. */
function sameWord(a: string, b: string): boolean {
  const fa = tokenizeWithOffsets(a)[0]?.folded ?? "";
  const fb = tokenizeWithOffsets(b)[0]?.folded ?? "";
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  if (Math.min(fa.length, fb.length) >= 4 && (fa.startsWith(fb) || fb.startsWith(fa))) return true;
  return fa.length >= 4 && fb.length >= 4 && stem(fa) === stem(fb);
}

/**
 * Keeps only the AI's terms that really occur in `userText` (all words of a
 * phrase, in a row, diacritic-insensitive, prefix-tolerant) and returns each as
 * the resident wrote it. Deduplicated, at most MAX_USER_TERMS.
 */
export function filterUserTerms(terms: readonly string[], userText: string): string[] {
  const text = userText.normalize("NFC");
  const words = tokenizeWithOffsets(text);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    if (out.length >= MAX_USER_TERMS) break;
    const parts = tokenizeWithOffsets(term).map((t) => t.text);
    if (parts.length === 0) continue;
    for (let i = 0; i + parts.length <= words.length; i++) {
      if (!parts.every((p, j) => sameWord(p, words[i + j]!.text))) continue;
      const span = text.slice(words[i]!.start, words[i + parts.length - 1]!.end);
      const key = span.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(span);
      }
      break;
    }
  }
  return out;
}

/**
 * Abstain only when the AI failed (it abstained, or nothing survived
 * verification) AND the keyword match is not confident either. When the AI
 * failed but the keyword match is confident, show the keyword results.
 */
export function decideAbstain(
  aiAbstain: boolean,
  matchesAfterVerify: readonly unknown[],
  keyword: Pick<KeywordResult, "isLowConfidence">,
): { abstain: boolean; fallbackToKeyword: boolean } {
  const aiFailed = aiAbstain || matchesAfterVerify.length === 0;
  return { abstain: aiFailed && keyword.isLowConfidence, fallbackToKeyword: aiFailed && !keyword.isLowConfidence };
}

export function finalizeMatches(ai: AiMatchOutput, ctx: FinalizeContext): FinalizedMatches {
  const dropped: FinalizedMatches["dropped"] = [];
  const matches: VerifiedMatch[] = [];
  const seen = new Set<string>();

  for (const m of ai.matches) {
    const id = m.innovationId;
    if (ai.abstain) {
      dropped.push({ innovationId: id, reason: "ai_abstained" });
      continue;
    }
    if (!ctx.allowedCardIds.has(id)) {
      dropped.push({ innovationId: id, reason: "not_allowed" });
      continue;
    }
    const card = ctx.cardsById.get(id);
    if (!card) {
      dropped.push({ innovationId: id, reason: "unknown_card" });
      continue;
    }
    if (seen.has(id)) {
      dropped.push({ innovationId: id, reason: "duplicate" });
      continue;
    }
    const sentences = new Map(card.sentences.map((s) => [s.id, s.text]));
    const evidence: VerifiedMatch["evidence"] = [];
    for (const sid of new Set(m.evidenceSentenceIds)) {
      const text = sentences.get(sid);
      if (text !== undefined && evidence.length < MAX_EVIDENCE) evidence.push({ id: sid, text });
    }
    if (evidence.length === 0) {
      dropped.push({ innovationId: id, reason: "no_evidence" });
      continue;
    }
    if (matches.length >= MAX_MATCHES) {
      dropped.push({ innovationId: id, reason: "over_cap" });
      continue;
    }
    seen.add(id);
    matches.push({
      card,
      why: clip(m.why, MAX_WHY_CHARS),
      userTerms: filterUserTerms(m.userTerms, ctx.userText),
      evidence,
      firstStep: clip(m.firstStep, MAX_FIRST_STEP_CHARS),
    });
  }

  const { abstain, fallbackToKeyword } = decideAbstain(ai.abstain, matches, ctx.keyword);
  return { matches: ai.abstain ? [] : matches, abstained: abstain, fallbackToKeyword, dropped };
}

/** Areas the AI named, kept only if valid; useful for the Mapa link. */
export function sanitizeAreas(areas: readonly unknown[]): MapaArea[] {
  const out: MapaArea[] = [];
  for (const a of areas) {
    const parsed = mapaAreaSchema.safeParse(a);
    if (parsed.success && !out.includes(parsed.data)) out.push(parsed.data);
  }
  return out;
}
