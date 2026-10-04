import { TRPCError } from "@trpc/server";
import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";

import { translatorFor } from "~/i18n/server";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimit,
} from "~/server/api/trpc";
import {
  caseOr404,
  limitReplyPerCode,
  ownsCase,
  recordMisses,
  requireToken,
} from "~/server/cases/access";
import { caseLocale } from "~/server/cases/author-text";
import { addMessage, createCase, setCaseStatus } from "~/server/cases/engine";
import { createCaseInputSchema } from "~/server/cases/input";
import { casePayloads } from "~/server/cases/payloads";
import { authorMessages, timelineFor } from "~/server/cases/queries";
import { AUTHOR_NAME } from "~/server/cases/types";
import { cases, messages } from "~/server/db/schema";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { deliveryModes } from "~/server/mail/send";

/**
 * Module V — the author's side of a Sprawa. Residents have no accounts: the
 * case code alone opens a case for reading (seniors read codes over the
 * phone); writing needs the private-link token too. Guessing is what is
 * limited, see `~/server/cases/access`. Never returns the contact.
 */
const codeInput = z.string().trim().min(1).max(40);
const tokenInput = z.string().max(200);

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
        // Only automated tests may flag their cases as sample data, and only
        // with a „[test]" title — `seed/clean-tests.ts` removes them.
        isSample: input.isSample === true && input.title.startsWith("[test]"),
        locale: ctx.locale,
      });
      return { code: r.code, accessToken: r.accessToken };
    }),

  /** The author's view: status, timeline and the visible thread. */
  get: publicProcedure
    .input(z.object({ code: codeInput, token: tokenInput.optional() }))
    .query(async ({ ctx, input }) => {
      const c = await caseOr404(ctx, input.code);
      const [timeline, thread, payloads] = await Promise.all([
        timelineFor(c),
        authorMessages(c.id),
        casePayloads(c, { staff: false, locale: ctx.locale }),
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
        /** The author's language (the plan and system notes are written in it). */
        locale: caseLocale(c.locale),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        /** The token is this case's private link: the author may write. */
        privateLink: ownsCase(c, input.token),
        ...payloads,
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

  /**
   * „Co dzieje się dalej" under a new case: the author's chosen channel and
   * what really leaves the system (demo mode, e-mail transport, ROPS inbox).
   */
  whatNext: publicProcedure
    .input(z.object({ code: codeInput, token: tokenInput }))
    .query(async ({ ctx, input }) => {
      const c = await caseOr404(ctx, input.code);
      await requireToken(ctx, c, input.token);
      return { contactPref: c.contactPref, ...deliveryModes() };
    }),

  /** The author writes back in the thread — needs the private-link token. */
  reply: publicProcedure
    .input(
      z.object({
        code: codeInput,
        token: tokenInput.optional(),
        body: z.string().trim().max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "cases.reply", { limit: 20, windowSec: 600 });
      const c = await caseOr404(ctx, input.code);
      await requireToken(ctx, c, input.token);
      if (input.body.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: translatorFor(ctx.locale, "cases")("reply.tooShort"),
        });
      }
      await limitReplyPerCode(ctx, c.code);
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
    .input(z.object({ codes: z.array(z.string().max(40)).max(20) }))
    .query(async ({ ctx, input }) => {
      await rateLimit(ctx, "cases.byCodes", { limit: 30, windowSec: 600 });
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
      // Codes this device remembered but that do not exist count as guesses.
      const misses = codes.length - rows.length;
      if (misses > 0) await recordMisses(ctx, misses);
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
