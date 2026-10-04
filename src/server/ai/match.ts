/**
 * The AI half of matchmaking: one structured Claude call that picks 0–3 cards
 * from the keyword top-15 and cites sentence ids. Its answer is untrusted until
 * `finalizeMatches` (src/server/domain/verify.ts) has checked every id.
 */
import { aiStructured, userData, type AiLocale, type AiResult } from "~/server/ai/structured";
import { buildMatchUserMessage, MATCH_SYSTEM_PROMPT } from "~/server/ai/prompts/match";
import type { LibraryCard } from "~/server/domain/types";
import { aiMatchOutputSchema, type AiMatchOutput } from "~/server/domain/verify";

/**
 * The longest a resident waits for the AI check, in total. The page says so
 * („najwyżej 30 sekund"), so it is enforced here: the SDK may retry a slow
 * call once, and two 20-second attempts would otherwise mean 40 seconds.
 */
export const MATCH_DEADLINE_MS = 30_000;
/** One attempt's timeout (the SDK client retries once). */
const ATTEMPT_TIMEOUT_MS = 20_000;

export async function matchProblem(opts: {
  /** Already redacted with redactPII. */
  query: string;
  /** Stable compact index of the whole library (cached system block). */
  compactIndex: string;
  /** Full cards the model may choose from (the keyword top-15). */
  candidates: readonly LibraryCard[];
  /** Language of `why` and `firstStep`: the language the resident wrote in. */
  locale?: AiLocale;
  /** Total time allowed; defaults to MATCH_DEADLINE_MS. */
  deadlineMs?: number;
}): Promise<AiResult<AiMatchOutput>> {
  const deadlineMs = opts.deadlineMs ?? MATCH_DEADLINE_MS;
  const call = aiStructured({
    fn: "match",
    schema: aiMatchOutputSchema,
    system: [{ text: MATCH_SYSTEM_PROMPT }, { text: opts.compactIndex, cache: true }],
    user: buildMatchUserMessage(opts.query, opts.candidates, userData),
    locale: opts.locale ?? "pl",
    effort: "low",
    maxTokens: 4000,
    timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, deadlineMs),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<AiResult<AiMatchOutput>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "timeout", latencyMs: deadlineMs }), deadlineMs);
  });
  try {
    return await Promise.race([call, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
