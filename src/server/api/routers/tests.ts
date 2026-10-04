import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { labelsFor } from "~/lib/domain";
import { createTRPCRouter, publicProcedure, rateLimit, roleProcedure } from "~/server/api/trpc";
import { contactOrGminaProblem, createCaseInLocale } from "~/server/ideas/case-helpers";
import { gminaOptions } from "~/server/ideas/data";
import { feedbackSchema, gminaKindKey, testSignUpSchema } from "~/server/ideas/schema";
import { feedbackSummary, testableById, testableBySlug, testingList } from "~/server/ideas/testing";

/**
 * Module IV — Tester innowacji. Sign-ups and ratings are Sprawy (kinds "test"
 * and "feedback") tied to the innovation; ROPS sees a summary per innovation.
 * Case texts are written in the author's language.
 */
async function gminaName(teryt: string | undefined, locale: Locale): Promise<string | null> {
  if (!teryt) return null;
  const { gminas, powiaty } = await gminaOptions();
  const g = gminas.find((x) => x.teryt === teryt);
  if (!g) return null;
  const p = powiaty.find((x) => x.teryt === g.powiatTeryt);
  const t = translatorFor(locale, "ideas");
  return t("people.gminaFull", { name: g.name, kind: gminaKindKey(g.kind), powiat: p?.name ?? "—" });
}

async function checkContact(
  locale: Locale,
  input: { contactPref: "email" | "sms" | "phone" | "none"; contact?: string; gminaTeryt?: string },
) {
  const problem = await contactOrGminaProblem(locale, input);
  if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });
}

async function innovationOr404(id: string, locale: Locale) {
  const inn = await testableById(id, locale);
  if (!inn) throw new TRPCError({ code: "NOT_FOUND", message: translatorFor(locale, "tester")("server.notFound") });
  return inn;
}

export const testsRouter = createTRPCRouter({
  /** Innovations open for testers — or, when none is flagged, the dissemination candidates. */
  list: publicProcedure.query(async ({ ctx }) => testingList(ctx.locale)),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => testableBySlug(input.slug, ctx.locale)),

  /** „Chcę testować" → Sprawa kind "test". */
  signUp: publicProcedure.input(testSignUpSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "tests.signUp", { limit: 8, windowSec: 600 });
    await checkContact(ctx.locale, input);
    const inn = await innovationOr404(input.innovationId, ctx.locale);
    const place = await gminaName(input.gminaTeryt, ctx.locale);
    const t = translatorFor(ctx.locale, "tester");
    const role = labelsFor(ctx.locale).authorRole[input.authorRole];
    const body = [
      t("caseBody.signUp", { title: inn.title }),
      t("caseBody.author", { role, onBehalf: input.onBehalf ? "yes" : "no" }),
      place ? t("caseBody.gmina", { place }) : "",
      input.note ? t("caseBody.note", { text: input.note }) : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const r = await createCaseInLocale(
      {
        kind: "test",
        title: t("caseBody.signUpTitle", { title: inn.title }).slice(0, 200),
        body,
        innovationId: inn.id,
        areas: inn.areas,
        gminaTeryt: input.gminaTeryt,
        powiatTeryt: input.gminaTeryt?.slice(0, 4),
        authorRole: input.authorRole,
        onBehalf: input.onBehalf,
        contactPref: input.contactPref,
        contact: input.contact,
      },
      ctx.locale,
    );
    return { code: r.code, accessToken: r.accessToken };
  }),

  /** Rating 1–5 with „Co działa? / Co poprawić? / Pomysł" → Sprawa kind "feedback". */
  rate: publicProcedure.input(feedbackSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "tests.rate", { limit: 8, windowSec: 600 });
    await checkContact(ctx.locale, input);
    const inn = await innovationOr404(input.innovationId, ctx.locale);
    const t = translatorFor(ctx.locale, "tester");
    const label = t(`rating.${String(input.rating) as "1" | "2" | "3" | "4" | "5"}`);
    const body = [
      t("caseBody.rating", { rating: input.rating, label }),
      input.works ? t("caseBody.works", { text: input.works }) : "",
      input.improve ? t("caseBody.improve", { text: input.improve }) : "",
      input.suggestion ? t("caseBody.suggestion", { text: input.suggestion }) : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const r = await createCaseInLocale(
      {
        kind: "feedback",
        title: t("caseBody.rateTitle", { rating: input.rating, title: inn.title }).slice(0, 200),
        body,
        innovationId: inn.id,
        rating: input.rating,
        areas: inn.areas,
        gminaTeryt: input.gminaTeryt,
        powiatTeryt: input.gminaTeryt?.slice(0, 4),
        authorRole: input.authorRole,
        onBehalf: input.onBehalf,
        contactPref: input.contactPref,
        contact: input.contact,
      },
      ctx.locale,
    );
    return { code: r.code, accessToken: r.accessToken };
  }),

  /** Staff: count, average rating and comments grouped into themes (AI; raw list without it). */
  summary: roleProcedure("rops", "expert")
    .input(z.object({ innovationId: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => feedbackSummary(input.innovationId, ctx.locale)),
});
