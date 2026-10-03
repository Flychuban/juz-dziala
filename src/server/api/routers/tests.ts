import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AUTHOR_ROLE_LABEL } from "~/lib/domain";
import { createTRPCRouter, publicProcedure, rateLimit, roleProcedure } from "~/server/api/trpc";
import { createCase } from "~/server/cases";
import { gminaOptions, isKnownGmina } from "~/server/ideas/data";
import { contactProblem, feedbackSchema, RATING_LABEL, testSignUpSchema } from "~/server/ideas/schema";
import { feedbackSummary, testableById, testableBySlug, testingList } from "~/server/ideas/testing";

/**
 * Module IV — Tester innowacji. Sign-ups and ratings are Sprawy (kinds "test"
 * and "feedback") tied to the innovation; ROPS sees a summary per innovation.
 */
async function gminaName(teryt: string | undefined): Promise<string | null> {
  if (!teryt) return null;
  const { gminas, powiaty } = await gminaOptions();
  const g = gminas.find((x) => x.teryt === teryt);
  if (!g) return null;
  const p = powiaty.find((x) => x.teryt === g.powiatTeryt);
  return `${g.name} (gmina ${g.kind}${p ? `, ${p.name}` : ""})`;
}

async function checkContact(input: { contactPref: "email" | "sms" | "phone" | "none"; contact?: string; gminaTeryt?: string }) {
  const problem = contactProblem(input.contactPref, input.contact);
  if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });
  if (!(await isKnownGmina(input.gminaTeryt))) throw new TRPCError({ code: "BAD_REQUEST", message: "Wybierz gminę z listy." });
}

async function innovationOr404(id: string) {
  const inn = await testableById(id);
  if (!inn) throw new TRPCError({ code: "NOT_FOUND", message: "Nie znaleźliśmy tej innowacji w Bibliotece." });
  return inn;
}

export const testsRouter = createTRPCRouter({
  /** Innovations open for testers — or, when none is flagged, the dissemination candidates. */
  list: publicProcedure.query(async () => testingList()),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(200) }))
    .query(async ({ input }) => testableBySlug(input.slug)),

  /** „Chcę testować" → Sprawa kind "test". */
  signUp: publicProcedure.input(testSignUpSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "tests.signUp", { limit: 8, windowSec: 600 });
    await checkContact(input);
    const inn = await innovationOr404(input.innovationId);
    const place = await gminaName(input.gminaTeryt);
    const body = [
      `Chcę testować rozwiązanie „${inn.title}”.`,
      `Zgłasza: ${AUTHOR_ROLE_LABEL[input.authorRole]}${input.onBehalf ? " (w imieniu innej osoby lub grupy)" : ""}.`,
      place ? `Gmina: ${place}.` : "",
      input.note ? `Od siebie: ${input.note}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const r = await createCase({
      kind: "test",
      title: `Zgłoszenie do testów: ${inn.title}`.slice(0, 200),
      body,
      innovationId: inn.id,
      areas: inn.areas,
      gminaTeryt: input.gminaTeryt,
      powiatTeryt: input.gminaTeryt?.slice(0, 4),
      authorRole: input.authorRole,
      onBehalf: input.onBehalf,
      contactPref: input.contactPref,
      contact: input.contact,
    });
    return { code: r.code, accessToken: r.accessToken };
  }),

  /** Rating 1–5 with „Co działa? / Co poprawić? / Pomysł" → Sprawa kind "feedback". */
  rate: publicProcedure.input(feedbackSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "tests.rate", { limit: 8, windowSec: 600 });
    await checkContact(input);
    const inn = await innovationOr404(input.innovationId);
    const label = RATING_LABEL[input.rating as 1 | 2 | 3 | 4 | 5];
    const body = [
      `Ocena: ${input.rating}/5 — ${label}`,
      input.works ? `Co działa: ${input.works}` : "",
      input.improve ? `Co poprawić: ${input.improve}` : "",
      input.suggestion ? `Pomysł na ulepszenie: ${input.suggestion}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const r = await createCase({
      kind: "feedback",
      title: `Opinia (${input.rating}/5): ${inn.title}`.slice(0, 200),
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
    });
    return { code: r.code, accessToken: r.accessToken };
  }),

  /** Staff: count, average rating and comments grouped into themes (AI; raw list without it). */
  summary: roleProcedure("rops", "expert")
    .input(z.object({ innovationId: z.string().min(1).max(64) }))
    .query(async ({ input }) => feedbackSummary(input.innovationId)),
});
