import { TRPCError } from "@trpc/server";

import { AUTHOR_ROLE_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";
import { createTRPCRouter, publicProcedure, rateLimit } from "~/server/api/trpc";
import { createCase } from "~/server/cases";
import { isKnownGmina, openCalls } from "~/server/ideas/data";
import { listOrgs, listPeople, subscribe } from "~/server/ideas/network";
import { normalizeSubscriptionContact, questionTitle } from "~/server/ideas/network-rules";
import { contactProblem, questionSchema, subscribeSchema } from "~/server/ideas/schema";

/**
 * Module V — /network (Sieć i mentorzy): organisations named in the library
 * cards (real), mentors and experts (fictional, „przykładowe"), questions to an
 * expert (Sprawa kind "question") and subscriptions to new calls / areas.
 */
export const networkRouter = createTRPCRouter({
  orgs: publicProcedure.query(async () => listOrgs()),

  people: publicProcedure.query(async () => listPeople()),

  /** Calls open now (status open or demo), with dates and the source link. */
  openCalls: publicProcedure.query(async () =>
    (await openCalls()).map((c) => ({
      id: c.id,
      name: c.name,
      program: c.program,
      operator: c.operator,
      status: c.status,
      windowFrom: c.windowFrom,
      windowTo: c.windowTo,
      amountMax: c.amountMax,
      eligibility: c.eligibility,
      sourceUrl: c.sourceUrl,
      notes: c.notes,
    })),
  ),

  /** „Zapytaj eksperta" → Sprawa kind "question". */
  ask: publicProcedure.input(questionSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "network.ask", { limit: 8, windowSec: 600 });
    const problem = contactProblem(input.contactPref, input.contact);
    if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });
    if (!(await isKnownGmina(input.gminaTeryt))) throw new TRPCError({ code: "BAD_REQUEST", message: "Wybierz gminę z listy." });
    const body = [
      input.question,
      input.area ? `Obszar: ${MAPA_AREA_LABEL[input.area]}` : "Obszar: nie wiem / inny",
      `Pyta: ${AUTHOR_ROLE_LABEL[input.authorRole]}${input.onBehalf ? " (w imieniu innej osoby lub grupy)" : ""}`,
    ].join("\n\n");
    const r = await createCase({
      kind: "question",
      title: questionTitle(input.question),
      body,
      areas: input.area ? [input.area] : [],
      gminaTeryt: input.gminaTeryt,
      powiatTeryt: input.gminaTeryt?.slice(0, 4),
      authorRole: input.authorRole,
      onBehalf: input.onBehalf,
      contactPref: input.contactPref,
      contact: input.contact,
    });
    return { code: r.code, accessToken: r.accessToken };
  }),

  /** „Powiadamiaj mnie…" — contact encrypted, only a masked copy is ever shown. */
  subscribe: publicProcedure.input(subscribeSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "network.subscribe", { limit: 10, windowSec: 600 });
    if (!normalizeSubscriptionContact(input.channel, input.contact)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: input.channel === "email" ? "Podaj adres e-mail, np. imie@przyklad.pl." : "Podaj numer telefonu — 9 cyfr, np. 600 100 200.",
      });
    }
    return subscribe(input);
  }),
});
