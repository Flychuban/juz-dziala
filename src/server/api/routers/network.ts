import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";

import { translatorFor } from "~/i18n/server";
import { labelsFor } from "~/lib/domain";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimit,
  type Context,
} from "~/server/api/trpc";
import { createCase } from "~/server/cases";
import {
  PARTNER_AUTHOR_ROLE,
  partnerInputSchema,
  partnershipCase,
} from "~/server/cases/partnership";
import { SAMPLE_PEOPLE_EN } from "~/server/cases/sample-people";
import { calls, innovations } from "~/server/db/schema";
import { isKnownGmina, openCalls } from "~/server/ideas/data";
import { listOrgs, listPeople, subscribe } from "~/server/ideas/network";
import {
  normalizeSubscriptionContact,
  questionTitle,
} from "~/server/ideas/network-rules";
import {
  contactProblem,
  questionSchema,
  subscribeSchema,
} from "~/server/ideas/schema";

/**
 * Module V — /network (Sieć i mentorzy): organisations named in the library
 * cards (real), mentors and experts (fictional, „przykładowe"), questions to an
 * expert and partnership requests (both a Sprawa of kind "question", brokered
 * by ROPS) and subscriptions to new calls / areas. Content comes in the
 * visitor's language when a translation exists; `lang` says which it is.
 */

/** The contact and gmina checks every form here repeats on the server. */
async function checkContactAndGmina(
  ctx: Context,
  input: {
    contactPref: "email" | "sms" | "phone" | "none";
    contact?: string;
    gminaTeryt?: string;
  },
) {
  const t = translatorFor(ctx.locale, "network");
  const problem = contactProblem(input.contactPref, input.contact);
  if (problem) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        input.contactPref === "email" ? t("errors.email") : t("errors.phone"),
    });
  }
  if (!(await isKnownGmina(input.gminaTeryt))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.gmina") });
  }
}

export const networkRouter = createTRPCRouter({
  orgs: publicProcedure.query(async ({ ctx }) => {
    const orgs = await listOrgs();
    if (ctx.locale !== "en") {
      return orgs.map((o) => ({
        ...o,
        innovations: o.innovations.map((i) => ({ ...i, lang: "pl" })),
      }));
    }
    const ids = [...new Set(orgs.flatMap((o) => o.innovations.map((i) => i.id)))];
    const rows = ids.length
      ? await ctx.db
          .select({ id: innovations.id, en: innovations.en })
          .from(innovations)
          .where(inArray(innovations.id, ids))
      : [];
    const enTitle = new Map(
      rows.flatMap((r) => (r.en?.title ? [[r.id, r.en.title] as const] : [])),
    );
    return orgs.map((o) => ({
      ...o,
      innovations: o.innovations.map((i) => {
        const title = enTitle.get(i.id);
        return title
          ? { ...i, title, lang: "en" }
          : { ...i, lang: "pl" };
      }),
    }));
  }),

  people: publicProcedure.query(async ({ ctx }) => {
    const people = await listPeople();
    return people.map((p) => {
      const en = ctx.locale === "en" ? SAMPLE_PEOPLE_EN[p.id] : undefined;
      return en
        ? { ...p, ...en, lang: "en" }
        : { ...p, lang: "pl" };
    });
  }),

  /** Calls open now (status open or demo), with dates and the source link. */
  openCalls: publicProcedure.query(async ({ ctx }) => {
    const open = await openCalls();
    const enRows =
      ctx.locale === "en" && open.length
        ? await ctx.db
            .select({ id: calls.id, en: calls.en })
            .from(calls)
            .where(
              inArray(
                calls.id,
                open.map((c) => c.id),
              ),
            )
        : [];
    const enById = new Map(
      enRows.flatMap((r) => (r.en ? [[r.id, r.en] as const] : [])),
    );
    return open.map((c) => {
      const en = enById.get(c.id);
      return {
        id: c.id,
        name: en?.name ?? c.name,
        program: en ? (en.program ?? c.program) : c.program,
        operator: en ? (en.operator ?? c.operator) : c.operator,
        status: c.status,
        windowFrom: c.windowFrom,
        windowTo: c.windowTo,
        amountMax: c.amountMax,
        eligibility: en?.eligibility.length ? en.eligibility : c.eligibility,
        sourceUrl: c.sourceUrl,
        notes: en ? (en.notes ?? c.notes) : c.notes,
        lang: en ? ("en" as const) : ("pl" as const),
      };
    });
  }),

  /** „Zapytaj eksperta" → Sprawa kind "question". */
  ask: publicProcedure.input(questionSchema).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx, "network.ask", { limit: 8, windowSec: 600 });
    await checkContactAndGmina(ctx, input);
    // The author sees their own question on the case page: their language.
    const t = translatorFor(ctx.locale, "network");
    const l = labelsFor(ctx.locale);
    const body = [
      input.question,
      input.area
        ? t("ask.case.area", { area: l.area[input.area] })
        : t("ask.case.areaUnknown"),
      t("ask.case.who", {
        role: l.authorRole[input.authorRole ?? "resident"],
        onBehalf: input.onBehalf ? "yes" : "no",
      }),
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
      locale: ctx.locale,
    });
    return { code: r.code, accessToken: r.accessToken };
  }),

  /**
   * „Szukam partnera" → Sprawa kind "question" titled „Partnerstwo: …". ROPS
   * brokers the contact in the thread; nobody's contact details are revealed.
   */
  partner: publicProcedure
    .input(partnerInputSchema)
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "network.partner", { limit: 8, windowSec: 600 });
      await checkContactAndGmina(ctx, input);
      const t = translatorFor(ctx.locale, "network");
      const { title, body } = partnershipCase(input, {
        prefix: t("partner.case.prefix"),
        intro: t("partner.case.intro"),
        who: t("partner.case.who"),
        typeLabel: t(`partner.type.${input.partnerType}`),
        org: t("partner.case.org"),
        offer: t("partner.case.offer"),
        need: t("partner.case.need"),
      });
      const r = await createCase({
        kind: "question",
        title,
        body,
        gminaTeryt: input.gminaTeryt,
        powiatTeryt: input.gminaTeryt?.slice(0, 4),
        authorRole: PARTNER_AUTHOR_ROLE[input.partnerType],
        onBehalf: false,
        contactPref: input.contactPref,
        contact: input.contact,
        locale: ctx.locale,
      });
      return { code: r.code, accessToken: r.accessToken };
    }),

  /** „Powiadamiaj mnie…" — contact encrypted, only a masked copy is ever shown. */
  subscribe: publicProcedure
    .input(subscribeSchema)
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "network.subscribe", { limit: 10, windowSec: 600 });
      if (!normalizeSubscriptionContact(input.channel, input.contact)) {
        const t = translatorFor(ctx.locale, "network");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            input.channel === "email" ? t("errors.email") : t("errors.phone"),
        });
      }
      return subscribe(input);
    }),
});
