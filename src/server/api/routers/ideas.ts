import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AUTHOR_ROLE_LABEL, IDEA_STAGE_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";
import { createTRPCRouter, publicProcedure, rateLimit } from "~/server/api/trpc";
import { addMessage, createCase } from "~/server/cases";
import { AUTHOR_NAME } from "~/server/cases/types";
import { cases } from "~/server/db/schema";
import { redactPII } from "~/server/domain/redact";
import { fieldsToMarkdown } from "~/server/ideas/application-rules";
import { assistIdea } from "~/server/ideas/assist";
import { sanitizeCanvas } from "~/server/ideas/canvas-def";
import { applicationCall, gminaOptions, isKnownGmina, loadCanvasDef, scoringCall } from "~/server/ideas/data";
import { loadIdeaCase } from "~/server/ideas/idea-case";
import {
  applicationFieldSchema,
  canvasValuesSchema,
  contactProblem,
  GAP,
  ideaAssistInputSchema,
  ideaSubmitSchema,
  type SelfScore,
  type StoredIdea,
} from "~/server/ideas/schema";
import { findSimilar } from "~/server/ideas/similar";
import { notify } from "~/server/notify";

/**
 * Module III — Kreator pomysłów. The fiszka becomes a Sprawa (kind "idea"); the
 * Canvas and the application draft are stored on that case. Everything works
 * without the AI: the duplicate check is keyword-based and the application has
 * an AI-free template (see /api/ideas/application).
 */
const codeInput = z.object({ code: z.string().trim().min(1).max(40), token: z.string().max(200).optional() });

const redact = (s: string) => redactPII(s).text;

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
  criteria: publicProcedure.query(async () => {
    const call = await scoringCall();
    if (!call) return null;
    return {
      callId: call.id,
      callName: call.name,
      minScore: call.minScore,
      sourceUrl: call.sourceUrl,
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
    return findSimilar(redact(input.text));
  }),

  /** The AI panel. `{ok:false, reason:"unavailable"}` when there is no API key. */
  assist: publicProcedure.input(ideaAssistInputSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.assist", { limit: 12, windowSec: 600 });
    return assistIdea(input);
  }),

  /** Submit the fiszka: opens a Sprawa and reports similar library cards. */
  submit: publicProcedure.input(ideaSubmitSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.submit", { limit: 6, windowSec: 600 });
    const problem = contactProblem(input.contactPref, input.contact);
    if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });
    if (!(await isKnownGmina(input.gminaTeryt))) throw new TRPCError({ code: "BAD_REQUEST", message: "Wybierz gminę z listy." });

    const similar = await findSimilar(redact(`${input.title}\n${input.description}\n${input.targetGroup}`));
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
    const body = [
      input.description,
      `Komu pomaga: ${input.targetGroup}`,
      `Etap: ${IDEA_STAGE_LABEL[input.stage]}`,
      input.areas.length ? `Obszary: ${input.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")}` : "",
      `Zgłasza: ${AUTHOR_ROLE_LABEL[input.authorRole]}${input.onBehalf ? " (w imieniu innej osoby lub grupy)" : ""}`,
      similar.length ? `Podobne w Bibliotece: ${similar.map((s) => s.title).join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const created = await createCase({
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
    });
    const top = similar[0];
    if (top) await notify({ type: "idea.similarFound", caseId: created.id, innovationId: top.innovationId });
    return { code: created.code, accessToken: created.accessToken, similar };
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

  /** Saves the interactive Canvas on the case (unknown keys and options are dropped). */
  saveCanvas: publicProcedure.input(codeInput.extend({ canvas: canvasValuesSchema })).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "ideas.canvas", { limit: 60, windowSec: 600 });
    const c = await loadIdeaCase(ctx, input.code, input.token);
    const def = await loadCanvasDef();
    if (!def) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Canvas jest chwilowo niedostępny." });
    const clean = sanitizeCanvas(def, input.canvas);
    const canvas = {
      notes: Object.fromEntries(Object.entries(clean.notes).map(([k, v]) => [k, redact(v)])),
      picks: clean.picks,
    };
    const now = new Date();
    await ctx.db.update(cases).set({ canvas, updatedAt: now }).where(eq(cases.id, c.row.id));
    return { savedAt: now };
  }),

  /** The call an application can be written for now (open, or the demo call). */
  applicationCall: publicProcedure.query(async () => applicationCall()),

  /** „Wyślij wniosek do ROPS": stores the fields on the case and tells ROPS in the thread. */
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
      const c = await loadIdeaCase(ctx, input.code, input.token);
      const call = await applicationCall();
      if (call?.id !== input.callId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ten nabór nie przyjmuje już wniosków." });
      }
      const byKey = new Map(input.fields.map((f) => [f.key, f.value]));
      const fields = call.formFields.map((f) => ({
        key: f.key,
        label: f.label,
        value: redact(byKey.get(f.key)?.trim() ?? ""),
      }));
      if (fields.every((f) => !f.value)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Wniosek jest pusty — uzupełnij przynajmniej jedno pole." });
      }
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
      const gaps = fields.filter((f) => !f.value || f.value.includes(GAP)).length;
      await addMessage({
        caseId: c.row.id,
        authorKind: "author",
        authorName: AUTHOR_NAME,
        body: [
          `Wysyłam wniosek do naboru „${call.name}”${call.status === "demo" ? " (nabór przykładowy — demo)" : ""}.`,
          gaps ? `Pola do uzupełnienia: ${gaps}.` : "Wszystkie pola są wypełnione.",
          "",
          fieldsToMarkdown(fields.map((f) => ({ ...f, value: f.value || GAP }))),
        ].join("\n"),
      });
      return { ok: true as const, gaps };
    }),

  /** Gminas and powiats for the pickers. */
  gminas: publicProcedure.query(async () => gminaOptions()),
});
