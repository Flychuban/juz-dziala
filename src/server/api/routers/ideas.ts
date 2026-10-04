import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { translatorFor } from "~/i18n/server";
import { labelsFor } from "~/lib/domain";
import { AI_STREAM_LINES } from "~/server/ai/structured";
import { createTRPCRouter, publicProcedure, rateLimit } from "~/server/api/trpc";
import { addMessage } from "~/server/cases";
import { AUTHOR_NAME } from "~/server/cases/types";
import { cases } from "~/server/db/schema";
import { redactPII } from "~/server/domain/redact";
import { countGaps, fieldsToMarkdown } from "~/server/ideas/application-rules";
import { assistIdea } from "~/server/ideas/assist";
import { sanitizeCanvas } from "~/server/ideas/canvas-def";
import { contactOrGminaProblem, createCaseInLocale } from "~/server/ideas/case-helpers";
import { applicationCallById, applicationCalls, gminaOptions, loadCanvasDef, localizeCall, scoringCall } from "~/server/ideas/data";
import { loadIdeaCase } from "~/server/ideas/idea-case";
import {
  applicationFieldSchema,
  canvasValuesSchema,
  gapFor,
  ideaAssistInputSchema,
  ideaSubmitSchema,
  type SelfScore,
  type StoredIdea,
} from "~/server/ideas/schema";
import { findSimilar, localizeSimilar } from "~/server/ideas/similar";
import { sketchIdea } from "~/server/ideas/sketch";
import { notify } from "~/server/notify";

/**
 * Module III — Kreator pomysłów. The fiszka becomes a Sprawa (kind "idea"); the
 * Canvas and the application draft are stored on that case. Everything works
 * without the AI: the duplicate check is keyword-based and the application has
 * an AI-free template (see /api/ideas/application).
 */
const codeInput = z.object({ code: z.string().trim().min(1).max(40), token: z.string().max(200).optional() });

const redact = (s: string) => redactPII(s).text;

/** Lines the AI wrapper writes instead of text — never stored as an answer. */
const SENTINELS: string[] = Object.values(AI_STREAM_LINES).flatMap((l) => Object.values(l));
const withoutSentinels = (v: string) =>
  v
    .split("\n")
    .filter((line) => !SENTINELS.includes(line.trim()))
    .join("\n")
    .trim();

/** Recomputes the totals of a self-assessment sent back by the browser. */
function recheckSelfScore(s: SelfScore | undefined): SelfScore | null {
  if (!s) return null;
  const items = s.items.map((i) => ({
    ...i,
    score: Math.max(0, Math.min(i.max, i.score)),
    reason: redact(i.reason),
    improve: redact(i.improve),
  }));
  const total = items.reduce((a, i) => a + i.score, 0);
  const max = items.reduce((a, i) => a + i.max, 0);
  const perCriterion = items.every((i) => i.minToPass === null || i.score >= i.minToPass);
  return { ...s, items, total, max, meetsMinimum: perCriterion && (s.minScore === null || total >= s.minScore) };
}

export const ideasRouter = createTRPCRouter({
  /** The IWS 2.0 criteria used by the self-assessment (names shown even without AI). */
  criteria: publicProcedure.query(async ({ ctx }) => {
    const found = await scoringCall();
    if (!found) return null;
    const call = localizeCall(found, ctx.locale);
    return {
      callId: call.id,
      callName: call.name,
      minScore: call.minScore,
      sourceUrl: call.sourceUrl,
      lang: call.lang,
      items: call.criteria.map((c) => ({
        key: c.key,
        label: c.label,
        max: c.max,
        minToPass: c.minToPass ?? null,
        description: c.description ?? null,
      })),
    };
  }),

  /** „To już istnieje": keyword duplicate check over the library (no AI). */
  similar: publicProcedure.input(z.object({ text: z.string().max(6000) })).query(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.similar", { limit: 120, windowSec: 600 });
    return findSimilar(redact(input.text), 3, ctx.locale);
  }),

  /** The AI panel. `{ok:false, reason:"unavailable"}` when there is no API key. */
  assist: publicProcedure.input(ideaAssistInputSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.assist", { limit: 12, windowSec: 600 });
    return assistIdea(input, ctx.locale);
  }),

  /** „Narysuj szkic pomysłu": a schematic picture as checked shapes (the page draws it). */
  sketch: publicProcedure.input(ideaAssistInputSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.sketch", { limit: 6, windowSec: 600 });
    return sketchIdea(input, ctx.locale);
  }),

  /** Submit the fiszka: opens a Sprawa and reports similar library cards. */
  submit: publicProcedure.input(ideaSubmitSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.submit", { limit: 6, windowSec: 600 });
    const problem = await contactOrGminaProblem(ctx.locale, input);
    if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

    // Stored (and shown to ROPS) with the Polish card titles; returned to the author in their language.
    const similar = await findSimilar(redact(`${input.title}\n${input.description}\n${input.targetGroup}`));
    const shown = await localizeSimilar(similar, ctx.locale);
    const idea: StoredIdea = {
      title: redact(input.title),
      description: redact(input.description),
      targetGroup: redact(input.targetGroup),
      areas: input.areas,
      stage: input.stage,
      selfScore: recheckSelfScore(input.selfScore),
      similar: similar.map((s) => ({ innovationId: s.innovationId, slug: s.slug, title: s.title })),
      application: null,
    };
    // The case body is read by the author and ROPS; it is written in the author's language.
    const t = translatorFor(ctx.locale, "ideas");
    const labels = labelsFor(ctx.locale);
    const body = [
      input.description,
      t("caseBody.targetGroup", { text: input.targetGroup }),
      t("caseBody.stage", { stage: labels.ideaStage[input.stage] }),
      input.areas.length ? t("caseBody.areas", { areas: input.areas.map((a) => labels.area[a]).join(", ") }) : "",
      t("caseBody.author", { role: labels.authorRole[input.authorRole], onBehalf: input.onBehalf ? "yes" : "no" }),
      similar.length ? t("caseBody.similar", { titles: shown.map((s) => s.title).join("; ") }) : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const created = await createCaseInLocale(
      {
        kind: "idea",
        title: input.title,
        body,
        gminaTeryt: input.gminaTeryt,
        powiatTeryt: input.gminaTeryt?.slice(0, 4),
        areas: input.areas,
        authorRole: input.authorRole,
        onBehalf: input.onBehalf,
        contactPref: input.contactPref,
        contact: input.contact,
        idea,
      },
      ctx.locale,
    );
    const top = similar[0];
    if (top) await notify({ type: "idea.similarFound", caseId: created.id, innovationId: top.innovationId });
    return { code: created.code, accessToken: created.accessToken, similar: shown };
  }),

  /** An idea case for the Canvas and the application pages. Never returns the contact. */
  get: publicProcedure.input(codeInput).query(async ({ ctx, input }) => {
    const c = await loadIdeaCase(ctx, input.code, input.token);
    return {
      code: c.row.code,
      title: c.row.title,
      status: c.row.status,
      idea: c.idea,
      canvas: c.canvas,
      callId: c.row.callId,
      updatedAt: c.row.updatedAt,
    };
  }),

  /** Saves the interactive Canvas on the case (unknown keys and options are dropped). Needs the private link. */
  saveCanvas: publicProcedure.input(codeInput.extend({ canvas: canvasValuesSchema })).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.canvas", { limit: 60, windowSec: 600 });
    const c = await loadIdeaCase(ctx, input.code, input.token, { write: true });
    const def = await loadCanvasDef();
    if (!def) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: translatorFor(ctx.locale, "ideas")("canvas.unavailable") });
    const clean = sanitizeCanvas(def, input.canvas);
    const canvas = {
      notes: Object.fromEntries(Object.entries(clean.notes).map(([k, v]) => [k, redact(v)])),
      picks: clean.picks,
    };
    const now = new Date();
    await ctx.db.update(cases).set({ canvas, updatedAt: now }).where(eq(cases.id, c.row.id));
    return { savedAt: now };
  }),

  /** The calls an application can be written for now (open, then demo), in the reader's language. */
  applicationCalls: publicProcedure.query(async ({ ctx }) => (await applicationCalls()).map((c) => localizeCall(c, ctx.locale))),

  /** „Wyślij wniosek do ROPS": stores the fields on the case and tells ROPS in the thread. Needs the private link. */
  submitApplication: publicProcedure
    .input(
      codeInput.extend({
        callId: z.string().max(64),
        fields: z.array(applicationFieldSchema).min(1).max(40),
        draftSource: z.enum(["ai", "template", "manual"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "ideas.application.submit", { limit: 6, windowSec: 600 });
      const t = translatorFor(ctx.locale, "ideas");
      const c = await loadIdeaCase(ctx, input.code, input.token, { write: true });
      const found = await applicationCallById(input.callId);
      if (!found) throw new TRPCError({ code: "BAD_REQUEST", message: t("application.server.callClosed") });
      const call = localizeCall(found, ctx.locale);
      const byKey = new Map(input.fields.map((f) => [f.key, f.value]));
      const fields = call.formFields.map((f) => ({
        key: f.key,
        label: f.label,
        value: redact(withoutSentinels(byKey.get(f.key) ?? "")),
      }));
      if (fields.every((f) => !f.value)) throw new TRPCError({ code: "BAD_REQUEST", message: t("application.server.empty") });
      const application = {
        callId: call.id,
        callName: call.name,
        fields,
        draftSource: input.draftSource,
        submittedAt: new Date().toISOString(),
      };
      await ctx.db
        .update(cases)
        .set({ idea: { ...c.idea, application }, callId: call.id, updatedAt: new Date() })
        .where(eq(cases.id, c.row.id));
      const gaps = countGaps(fields);
      const gap = gapFor(ctx.locale);
      await addMessage({
        caseId: c.row.id,
        authorKind: "author",
        authorName: AUTHOR_NAME,
        body: [
          t("application.server.message", {
            name: call.name,
            // Say „demo" once: the demo calls' names already say it.
            demo: call.status === "demo" && !/demo/i.test(call.name) ? "yes" : "no",
          }),
          gaps ? t("application.server.messageGaps", { count: gaps }) : t("application.server.messageComplete"),
          "",
          fieldsToMarkdown(fields.map((f) => ({ ...f, value: f.value || gap }))),
        ].join("\n"),
      });
      return { ok: true as const, gaps };
    }),

  /** Gminas and powiats for the pickers. */
  gminas: publicProcedure.query(async () => gminaOptions()),
});
