import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { powiatName } from "~/components/map/powiaty";
import { translatorFor } from "~/i18n/server";
import { labelsFor, type MapaArea } from "~/lib/domain";
import { getGmina, loadGminas, ramowyPlanIndex } from "~/server/adapt/data";
import {
  INSTITUTION_AUTHOR_ROLE,
  optionLabels,
  PLAN_SOURCES,
  planInputSchema,
} from "~/server/adapt/options";
import { gminaLabel } from "~/server/adapt/profile";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimit,
} from "~/server/api/trpc";
import { createCase } from "~/server/cases";
import { innovations } from "~/server/db/schema";
import { redactPII } from "~/server/domain/redact";
import { firstSentence } from "./library";

const MAX_PLAN_CHARS = 60_000;
const MAX_CASE_BODY = 7900;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AdaptInnovationOption = {
  id: string;
  slug: string;
  /** In the visitor's language when a translation exists (see `lang`). */
  title: string;
  categoryLabels: string[];
  areaLabels: string[];
  summary: string;
  /** "pl" when the card is not translated yet: shown with lang="pl". */
  lang: "pl" | "en";
  badge: boolean;
  ramowyPlan: { callName: string; sourceUrl: string | null } | null;
};

export type GminaOption = {
  teryt: string;
  name: string;
  kind: string;
  /** The powiat as the visitor reads it („powiat bocheński" / "Bochnia County"). */
  powiatName: string;
  label: string;
};

/** Module VII — Middleman Innowacji: options for the wizard and „send to ROPS". */
export const adaptRouter = createTRPCRouter({
  /**
   * Every published card (with the Ramowy Plan flag) and every gmina, in the
   * visitor's language. A card without a translation keeps its Polish text.
   */
  options: publicProcedure.query(async ({ ctx }) => {
    const en = ctx.locale === "en";
    const L = labelsFor(ctx.locale);
    const [cards, gminas, ramowy] = await Promise.all([
      ctx.db
        .select({
          id: innovations.id,
          slug: innovations.slug,
          title: innovations.title,
          mapaAreas: innovations.mapaAreas,
          categoryLabels: innovations.categoryLabels,
          sections: innovations.sections,
          sentences: innovations.sentences,
          badge: innovations.badge,
          en: innovations.en,
        })
        .from(innovations)
        .where(eq(innovations.status, "published")),
      loadGminas(),
      ramowyPlanIndex(ctx.db),
    ]);
    const innovationOptions: AdaptInnovationOption[] = cards
      .map((c) => {
        const rp = ramowy.get(c.id);
        const tr = en ? c.en : null;
        const summary = tr
          ? firstSentence(
              c.sentences.map((s) => ({
                ...s,
                text: tr.sentences[s.id] ?? s.text,
              })),
              { ...c.sections, ...tr.sections },
            )
          : firstSentence(c.sentences, c.sections);
        return {
          id: c.id,
          slug: c.slug,
          title: tr?.title ?? c.title,
          categoryLabels: tr?.categoryLabels.length
            ? tr.categoryLabels
            : c.categoryLabels,
          areaLabels: c.mapaAreas.map((a: MapaArea) => L.area[a]),
          summary,
          lang: tr ? ("en" as const) : ("pl" as const),
          badge: !!c.badge,
          ramowyPlan: rp
            ? { callName: rp.callName, sourceUrl: rp.sourceUrl }
            : null,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title, ctx.locale));
    const gminaOptions: GminaOption[] = gminas.map((g) => ({
      teryt: g.teryt,
      name: g.name,
      kind: g.kind,
      powiatName: powiatName(g.powiatName, ctx.locale),
      label: gminaLabel(g, ctx.locale),
    }));
    return { innovations: innovationOptions, gminas: gminaOptions };
  }),

  /**
   * „Poproś ROPS o wsparcie we wdrożeniu" — opens an `adapt` Sprawa with the
   * plan attached. The plan is the institution's own draft (it came back to
   * the browser), so it is redacted and capped like any other text. The
   * summary is written in the author's language, like the plan itself.
   * Validation messages are keys of `adapt.validation` (the form translates).
   */
  requestSupport: publicProcedure
    .input(
      z.object({
        inputs: planInputSchema,
        markdown: z
          .string()
          .trim()
          .min(50, "planTooShort")
          .max(MAX_PLAN_CHARS, "planTooLong"),
        mode: z.enum(PLAN_SOURCES),
        email: z
          .string()
          .trim()
          .max(200)
          .optional()
          .refine((v) => !v || EMAIL_RE.test(v), { message: "email" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "adapt.requestSupport", {
        limit: 5,
        windowSec: 600,
      });
      const t = translatorFor(ctx.locale, "adapt");
      const o = optionLabels(ctx.locale);
      const [gmina, card, ramowyIndex] = await Promise.all([
        getGmina(input.inputs.gminaTeryt),
        ctx.db.query.innovations.findFirst({
          where: eq(innovations.id, input.inputs.innovationId),
          columns: {
            id: true,
            title: true,
            mapaAreas: true,
            status: true,
            en: true,
          },
        }),
        ramowyPlanIndex(ctx.db),
      ]);
      if (card?.status !== "published" || !gmina) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: t("errors.supportNotFound"),
        });
      }
      const title =
        ctx.locale === "en" && card.en?.title ? card.en.title : card.title;
      const ramowy = ramowyIndex.get(card.id);
      const markdown = redactPII(input.markdown).text;
      const needs = input.inputs.needs?.trim()
        ? redactPII(input.inputs.needs.trim()).text
        : null;
      const i = input.inputs;
      const s = (key: Parameters<typeof t>[0], v?: Record<string, string>) =>
        t(key, v);
      const summary = [
        s("caseSummary.intro"),
        "",
        s("caseSummary.innovation", { value: title }),
        s("caseSummary.institution", { value: o.institution[i.institution] }),
        s("caseSummary.gmina", {
          value: `${gminaLabel(gmina, ctx.locale)}, ${powiatName(gmina.powiatName, ctx.locale)}`,
        }),
        s("caseSummary.staff", { value: o.staff[i.staff] }),
        s("caseSummary.budget", { value: o.budget[i.budget] }),
        s("caseSummary.timeframe", { value: o.timeframe[i.timeframe] }),
        s("caseSummary.groupSize", {
          value: i.groupSize ? String(i.groupSize) : t("plan.notGiven"),
        }),
        needs ? s("caseSummary.needs", { value: needs }) : null,
        ramowy ? s("caseSummary.ramowy") : null,
        s(`caseSummary.source.${input.mode}`),
        ctx.locale === "en" ? s("caseSummary.language") : null,
        "",
        s("caseSummary.planBelow"),
        "",
      ]
        .filter((l) => l !== null)
        .join("\n");
      const room = MAX_CASE_BODY - summary.length;
      const body =
        summary +
        (markdown.length > room
          ? `${markdown.slice(0, Math.max(0, room - 2))}…`
          : markdown);

      const res = await createCase({
        kind: "adapt",
        title: t("caseSummary.title", { title, gmina: gmina.name }).slice(0, 200),
        body,
        gminaTeryt: gmina.teryt,
        powiatTeryt: gmina.powiatTeryt,
        areas: card.mapaAreas,
        authorRole: INSTITUTION_AUTHOR_ROLE[i.institution],
        contactPref: input.email ? "email" : "none",
        contact: input.email ?? undefined,
        innovationId: card.id,
        callId: ramowy?.callId,
        plan: {
          markdown,
          mode: input.mode,
          locale: ctx.locale,
          inputs: { ...i, needs },
          innovationTitle: title,
          gminaName: gmina.name,
          ramowyPlan: ramowy ?? null,
          submittedAt: new Date().toISOString(),
        },
      });
      return { code: res.code, accessToken: res.accessToken };
    }),
});
