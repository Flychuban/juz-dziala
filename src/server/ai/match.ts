/**
 * The AI half of matchmaking: one structured Claude call that picks 0–3 cards
 * from the keyword top-15 and cites sentence ids. Its answer is untrusted until
 * `finalizeMatches` (src/server/domain/verify.ts) has checked every id.
 */
import { aiStructured, userData, type AiResult } from "~/server/ai/structured";
import { buildMatchUserMessage, MATCH_SYSTEM_PROMPT } from "~/server/ai/prompts/match";
import type { LibraryCard } from "~/server/domain/types";
import { aiMatchOutputSchema, type AiMatchOutput } from "~/server/domain/verify";

export const MATCH_TIMEOUT_MS = 30_000;

export async function matchProblem(opts: {
  /** Already redacted with redactPII. */
  query: string;
  /** Stable compact index of the whole library (cached system block). */
  compactIndex: string;
  /** Full cards the model may choose from (the keyword top-15). */
  candidates: readonly LibraryCard[];
}): Promise<AiResult<AiMatchOutput>> {
  return aiStructured({
    fn: "match",
    schema: aiMatchOutputSchema,
    system: [{ text: MATCH_SYSTEM_PROMPT }, { text: opts.compactIndex, cache: true }],
    user: buildMatchUserMessage(opts.query, opts.candidates, userData),
    effort: "low",
    maxTokens: 4000,
    timeoutMs: MATCH_TIMEOUT_MS,
  });
}
