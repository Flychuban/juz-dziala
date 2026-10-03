import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  roleProcedure,
} from "~/server/api/trpc";
import { caseOr404 } from "~/server/cases/access";
import { staffRecipient } from "~/server/cases/queries";
import { notifications } from "~/server/db/schema";

/**
 * In-app notifications. Staff read theirs through the bell (polled every
 * 5 s); the author's are addressed to "case:<caseId>".
 */
const staff = roleProcedure("rops", "expert");

const fields = {
  id: notifications.id,
  kind: notifications.kind,
  title: notifications.title,
  body: notifications.body,
  href: notifications.href,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

export const notificationsRouter = createTRPCRouter({
  /** Unread count + the latest 10 for the signed-in staff member. */
  forStaff: staff.query(async ({ ctx }) => {
    const recipient = staffRecipient(ctx.staff);
    const [unread, items] = await Promise.all([
      ctx.db
        .select({ n: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipient, recipient),
            isNull(notifications.readAt),
          ),
        ),
      ctx.db
        .select(fields)
        .from(notifications)
        .where(eq(notifications.recipient, recipient))
        .orderBy(desc(notifications.createdAt))
        .limit(10),
    ]);
    return { role: ctx.staff.role, unread: unread[0]?.n ?? 0, items };
  }),

  /** Mark some (ids) or all of the signed-in staff member's notifications read. */
  markRead: staff
    .input(
      z.object({
        ids: z.array(z.uuid()).max(100).optional(),
        all: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const recipient = staffRecipient(ctx.staff);
      if (!input.all && !input.ids?.length) return { updated: 0 };
      const rows = await ctx.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.recipient, recipient),
            isNull(notifications.readAt),
            input.all ? undefined : inArray(notifications.id, input.ids ?? []),
          ),
        )
        .returning({ id: notifications.id });
      return { updated: rows.length };
    }),

  /** What the author has been told about their case (newest first). */
  forCase: publicProcedure
    .input(z.object({ code: z.string().trim().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const c = await caseOr404(ctx, input.code);
      return ctx.db
        .select({
          id: fields.id,
          kind: fields.kind,
          title: fields.title,
          body: fields.body,
          createdAt: fields.createdAt,
        })
        .from(notifications)
        .where(eq(notifications.recipient, `case:${c.id}`))
        .orderBy(desc(notifications.createdAt))
        .limit(20);
    }),
});
