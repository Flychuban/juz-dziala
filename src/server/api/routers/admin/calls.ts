import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  callInputSchema,
  listCalls,
  publishCall,
  recentCallDeliveries,
  saveCall,
} from "~/server/admin/calls";
import { translatorFor } from "~/i18n/server";
import { createTRPCRouter, roleProcedure } from "~/server/api/trpc";
import { calls, subscriptions } from "~/server/db/schema";

const rops = roleProcedure("rops");
const actor = (s: { role: string; personId: string }) =>
  `${s.role}:${s.personId}`;

/** VI · Calls editor (ROPS only). */
export const adminCallsRouter = createTRPCRouter({
  list: rops.query(({ ctx }) => listCalls(ctx.db)),

  get: rops
    .input(z.object({ id: z.string().min(1).max(80) }))
    .query(async ({ ctx, input }) => {
      const [c] = await ctx.db
        .select()
        .from(calls)
        .where(eq(calls.id, input.id));
      return c ?? null;
    }),

  /** Active subscriptions per topic ("calls", "area:<key>"). */
  subscribers: rops.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ topic: subscriptions.topic, count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(and(eq(subscriptions.active, true)))
      .groupBy(subscriptions.topic);
    return Object.fromEntries(rows.map((r) => [r.topic, r.count]));
  }),

  /** Creates (id null) or updates a call. Live at once; nobody is notified. */
  save: rops
    .input(
      z.object({
        id: z.string().min(1).max(80).nullable(),
        input: callInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveCall(ctx.db, actor(ctx.staff), input.id, input.input);
      } catch (e) {
        if (e instanceof Error && e.message === "calls.notFound")
          throw new Error(translatorFor(ctx.locale, "admin")("calls.notFound"));
        throw e;
      }
    }),

  /** „Opublikuj zmiany": notify() + the deliveries it produced. */
  publish: rops
    .input(z.object({ id: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const res = await publishCall(ctx.db, actor(ctx.staff), input.id);
      if (!res)
        throw new Error(translatorFor(ctx.locale, "admin")("calls.notFound"));
      return res;
    }),

  /** Latest call notices sent to subscribers. */
  deliveries: rops.query(({ ctx }) => recentCallDeliveries(ctx.db)),
});
