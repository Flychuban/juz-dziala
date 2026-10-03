import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { INNOVATION_STATUS } from "~/lib/domain";
import {
  categoryLabels,
  createInnovation,
  innovationInputSchema,
  newInnovationSchema,
  saveInnovation,
} from "~/server/admin/library";
import { createTRPCRouter, roleProcedure } from "~/server/api/trpc";
import { auditLog, innovations } from "~/server/db/schema";

const rops = roleProcedure("rops");

const fold = (s: string) =>
  s.replace(/[łŁ]/g, "l").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** VI · Library editor (ROPS only). */
export const adminLibraryRouter = createTRPCRouter({
  /** Every card, any status; optional search (title, keywords) and status filter. */
  list: rops
    .input(
      z
        .object({
          q: z.string().trim().max(200).optional(),
          status: z.enum(INNOVATION_STATUS).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: innovations.id,
          slug: innovations.slug,
          title: innovations.title,
          status: innovations.status,
          mapaAreas: innovations.mapaAreas,
          categoryLabels: innovations.categoryLabels,
          keywords: innovations.keywords,
          testingOpen: innovations.testingOpen,
          videoUrl: innovations.videoUrl,
          updatedAt: innovations.updatedAt,
          updatedBy: innovations.updatedBy,
        })
        .from(innovations)
        .orderBy(desc(innovations.updatedAt));
      const words = fold(input?.q ?? "")
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      return rows.filter(
        (r) =>
          (!input?.status || r.status === input.status) &&
          words.every((w) =>
            fold(
              `${r.title} ${r.keywords.join(" ")} ${r.id} ${r.slug}`,
            ).includes(w),
          ),
      );
    }),

  /** One card for the editor, with its last changes. */
  get: rops
    .input(z.object({ slug: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.db.query.innovations.findFirst({
        where: eq(innovations.slug, input.slug),
      });
      if (!card) return null;
      const history = await ctx.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, card.id))
        .orderBy(desc(auditLog.createdAt))
        .limit(5);
      return {
        card,
        history: history.filter((h) => h.entity === "innovation"),
      };
    }),

  /** Category options (slug + label) used in the library. */
  categories: rops.query(({ ctx }) => categoryLabels(ctx.db)),

  /** Saves an edit: sentences re-derived, diff audited, pages revalidated. */
  save: rops
    .input(
      z.object({ id: z.string().min(1).max(40), input: innovationInputSchema }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await saveInnovation(
        ctx.db,
        `${ctx.staff.role}:${ctx.staff.personId}`,
        input.id,
        input.input,
      );
      if (!res) throw new Error("Nie znaleziono karty.");
      return res;
    }),

  /** Creates a card (from a document draft or by hand). */
  create: rops
    .input(newInnovationSchema)
    .mutation(({ ctx, input }) =>
      createInnovation(
        ctx.db,
        `${ctx.staff.role}:${ctx.staff.personId}`,
        input,
      ),
    ),
});
