import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { translatorFor } from "~/i18n/server";
import { createTRPCRouter, publicProcedure, rateLimit, type Context } from "~/server/api/trpc";
import { getMatchView, MatchNotFoundError, refineMatch, startMatch, type MatchView } from "~/server/match/pipeline";

/**
 * Module I — Matchmaking.
 * start  → instant keyword result (no AI), saved as a run;
 * refine → the AI check of that run (idempotent, rate-limited per session;
 *          `retry` repeats a check that failed);
 * get    → the run as the page shows it (reload, shared link).
 * The same start logic serves the no-JavaScript form (src/app/match/new/route.ts).
 */
const runIdInput = z.object({ runId: z.string().uuid() });

export const MATCH_TEXT_MIN = 3;
export const MATCH_TEXT_MAX = 3000;

/** The form's fields. Messages are chosen by the page from the issue (too short / too long), in its language. */
export const matchStartInput = z.object({
  text: z.string().trim().min(MATCH_TEXT_MIN).max(MATCH_TEXT_MAX),
  gminaTeryt: z
    .string()
    .regex(/^\d{6,7}$/u)
    .optional(),
});

export const START_RATE_LIMIT = { limit: 30, windowSec: 600 } as const;

/** Rate-limited start of a match run; shared by the tRPC mutation and the form's route handler. */
export async function startMatchFor(ctx: Context, input: z.infer<typeof matchStartInput>): Promise<MatchView> {
  await rateLimit(ctx, "match.start", START_RATE_LIMIT);
  return startMatch(input, ctx);
}

async function orNotFound(ctx: Context, p: Promise<MatchView>): Promise<MatchView> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof MatchNotFoundError) {
      throw new TRPCError({ code: "NOT_FOUND", message: translatorFor(ctx.locale, "match")("errors.notFound") });
    }
    throw e;
  }
}

export const matchRouter = createTRPCRouter({
  start: publicProcedure.input(matchStartInput).mutation(({ ctx, input }) => startMatchFor(ctx, input)),

  refine: publicProcedure
    .input(runIdInput.extend({ retry: z.boolean().optional() }))
    .mutation(({ ctx, input }) =>
      orNotFound(
        ctx,
        refineMatch(input.runId, ctx, {
          retry: input.retry ?? false,
          beforeAi: () => rateLimit(ctx, "match.refine", { limit: 12, windowSec: 600 }),
        }),
      ),
    ),

  get: publicProcedure.input(runIdInput).query(({ ctx, input }) => orNotFound(ctx, getMatchView(input.runId, ctx))),
});
