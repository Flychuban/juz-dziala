import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure, rateLimit } from "~/server/api/trpc";
import { getMatchView, MatchNotFoundError, refineMatch, startMatch, type MatchView } from "~/server/match/pipeline";

/**
 * Module I — Matchmaking.
 * start  → instant keyword result (no AI), saved as a run;
 * refine → the AI check of that run (idempotent, rate-limited per session);
 * get    → the run as the page shows it (reload, shared link).
 */
const runIdInput = z.object({ runId: z.string().uuid() });

async function orNotFound(p: Promise<MatchView>): Promise<MatchView> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof MatchNotFoundError) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Nie znaleźliśmy tego wyszukiwania." });
    }
    throw e;
  }
}

export const matchRouter = createTRPCRouter({
  start: publicProcedure
    .input(
      z.object({
        text: z
          .string()
          .trim()
          .min(3, "Opisz problem w kilku słowach.")
          .max(3000, "Opis jest za długi — skróć go do 3000 znaków."),
        gminaTeryt: z
          .string()
          .regex(/^\d{6,7}$/u)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "match.start", { limit: 30, windowSec: 600 });
      return startMatch(input, ctx);
    }),

  refine: publicProcedure.input(runIdInput).mutation(({ ctx, input }) =>
    orNotFound(
      refineMatch(input.runId, ctx, {
        beforeAi: () => rateLimit(ctx, "match.refine", { limit: 12, windowSec: 600 }),
      }),
    ),
  ),

  get: publicProcedure.input(runIdInput).query(({ ctx, input }) => orNotFound(getMatchView(input.runId, ctx))),
});
