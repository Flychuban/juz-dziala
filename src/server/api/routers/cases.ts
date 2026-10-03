import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  rateLimit,
} from "~/server/api/trpc";
import { caseOr404 } from "~/server/cases/access";
import { addMessage, createCase, setCaseStatus } from "~/server/cases/engine";
import { createCaseInputSchema } from "~/server/cases/input";
import { authorMessages, timelineFor } from "~/server/cases/queries";
import { AUTHOR_NAME } from "~/server/cases/types";
import { cases, messages } from "~/server/db/schema";
import { hashToken, normalizeCaseCode } from "~/server/domain/case-code";

/**
 * Module V — the author's side of a Sprawa. Residents have no accounts: the
 * case code is the key (the private link adds a token). Never returns the
 * contact.
 */
const codeInput = z.string().trim().min(1).max(40);

export const casesRouter = createTRPCRouter({
  /** Open a Sprawa from a public form. Other modules call `createCase()` directly. */
  create: publicProcedure
    .input(createCaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "cases.create", { limit: 8, windowSec: 600 });
      // Module payloads (idea, canvas, plan) come only from server-side callers.
      const r = await createCase({
        ...input,
        idea: undefined,
        canvas: undefined,
        plan: undefined,
        isSample: false,
      });
      return { code: r.code, accessToken: r.accessToken };
    }),

  /** The author's view: status, timeline and the visible thread. */
  get: publicProcedure
    .input(z.object({ code: codeInput, token: z.string().max(200).optional() }))
    .query(async ({ ctx, input }) => {
      const c = await caseOr404(ctx, input.code);
      const [timeline, thread] = await Promise.all([
        timelineFor(c),
        authorMessages(c.id),
      ]);
      return {
        code: c.code,
        kind: c.kind,
        title: c.title,
        body: c.bodyRedacted,
        status: c.status,
        contactPref: c.contactPref,
        onBehalf: c.onBehalf,
        isSample: c.isSample,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        privateLink: input.token
          ? hashToken(input.token) === c.tokenHash
          : false,
        timeline,
        messages: thread.map((m) => ({
          id: m.id,
          from:
            m.authorKind === "author"
              ? ("author" as const)
              : m.authorKind === "system"
                ? ("system" as const)
                : ("staff" as const),
          authorKind: m.authorKind,
          authorName: m.authorName,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
    }),

  /** The author writes back in the thread. */
  reply: publicProcedure
    .input(
      z.object({
        code: codeInput,
        body: z
          .string()
          .trim()
          .min(2, "Napisz wiadomość — co najmniej 2 znaki.")
          .max(4000, "Wiadomość jest za długa — skróć ją do 4000 znaków."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "cases.reply", { limit: 20, windowSec: 600 });
      const c = await caseOr404(ctx, input.code);
      const m = await addMessage({
        caseId: c.id,
        authorKind: "author",
        authorName: AUTHOR_NAME,
        body: input.body,
      });
      // A follow-up after an answer needs the team again.
      if (c.status === "answered" || c.status === "closed") {
        await setCaseStatus(c.id, "in_progress");
      }
      return { id: m.id };
    }),

  /** „Twoje sprawy na tym urządzeniu" — codes kept in localStorage. */
  byCodes: publicProcedure
    .input(z.object({ codes: z.array(z.string().max(40)).max(30) }))
    .query(async ({ ctx, input }) => {
      const codes = [
        ...new Set(
          input.codes
            .map((c) => normalizeCaseCode(c))
            .filter((c): c is string => !!c),
        ),
      ];
      if (!codes.length) return [];
      const rows = await ctx.db
        .select({
          id: cases.id,
          code: cases.code,
          kind: cases.kind,
          title: cases.title,
          status: cases.status,
          createdAt: cases.createdAt,
          lastActivityAt: cases.lastActivityAt,
        })
        .from(cases)
        .where(inArray(cases.code, codes));
      const replies = rows.length
        ? await ctx.db
            .select({ caseId: messages.caseId, at: max(messages.createdAt) })
            .from(messages)
            .where(
              and(
                inArray(
                  messages.caseId,
                  rows.map((r) => r.id),
                ),
                inArray(messages.authorKind, ["rops", "expert"]),
                eq(messages.visibleToAuthor, true),
              ),
            )
            .groupBy(messages.caseId)
        : [];
      const lastReply = new Map(replies.map((r) => [r.caseId, r.at]));
      const byCode = new Map(rows.map((r) => [r.code, r]));
      return codes.flatMap((code) => {
        const r = byCode.get(code);
        if (!r) return [];
        const { id, ...rest } = r;
        return [{ ...rest, lastStaffReplyAt: lastReply.get(id) ?? null }];
      });
    }),
});
