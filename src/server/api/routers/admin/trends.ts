import { z } from "zod";

import { mapaAreaSchema } from "~/lib/domain";
import {
  loadNeeds,
  proposeCallTopic,
  summarize,
  TREND_DAYS,
  whiteSpots,
} from "~/server/admin/trends";
import { createTRPCRouter, roleProcedure } from "~/server/api/trpc";

const rops = roleProcedure("rops");

const filter = z.object({
  area: mapaAreaSchema.nullish(),
  days: z
    .number()
    .int()
    .refine((d) => (TREND_DAYS as readonly number[]).includes(d))
    .default(30),
});

/** II (admin only) · Needs over time and „Białe plamy". */
export const adminTrendsRouter = createTRPCRouter({
  /** Totals, per powiat, per area, per week, and area × powiat × week cells. */
  overview: rops.input(filter).query(async ({ ctx, input }) => {
    const needs = await loadNeeds(ctx.db, {
      days: input.days,
      area: input.area,
    });
    return summarize(needs);
  }),

  /** Unmet needs grouped by area × powiat with redacted example phrasings. */
  whiteSpots: rops
    .input(filter)
    .query(async ({ ctx, input }) =>
      whiteSpots(
        await loadNeeds(ctx.db, { days: input.days, area: input.area }),
      ),
    ),

  /** „Zaproponuj temat naboru" — an AI draft for ROPS staff. */
  proposeCallTopic: rops
    .input(
      z.object({
        area: z.union([mapaAreaSchema, z.literal("none")]),
        powiat: z
          .string()
          .regex(/^\d{4}$/)
          .nullable(),
        days: filter.shape.days,
      }),
    )
    .mutation(({ ctx, input }) => proposeCallTopic(ctx.db, input)),
});
