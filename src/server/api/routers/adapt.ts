import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { MAPA_AREA_LABEL } from "~/lib/domain";
import { getGmina, loadGminas, ramowyPlanIndex } from "~/server/adapt/data";
import {
  BUDGET_LABEL,
  INSTITUTION_AUTHOR_ROLE,
  INSTITUTION_LABEL,
  planInputSchema,
  STAFF_LABEL,
  TIMEFRAME_LABEL,
} from "~/server/adapt/options";
import { gminaLabel } from "~/server/adapt/profile";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimit,
} from "~/server/api/trpc";
import { createCase } from "~/server/cases";
import { redactPII } from "~/server/domain/redact";
import { listInnovations } from "./library";

const MAX_PLAN_CHARS = 60_000;
const MAX_CASE_BODY = 7900;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AdaptInnovationOption = {
  id: string;
  slug: string;
  title: string;
  categoryLabels: string[];
  areaLabels: string[];
  summary: string;
  badge: boolean;
  ramowyPlan: { callName: string; sourceUrl: string | null } | null;
};

export type GminaOption = {
  teryt: string;
  name: string;
  kind: string;
  powiatName: string;
  label: string;
};

/** Module VII — Middleman Innowacji: options for the wizard and „send to ROPS". */
export const adaptRouter = createTRPCRouter({
  /** Every published card (with the Ramowy Plan flag) and every gmina. */
  options: publicProcedure.query(async ({ ctx }) => {
    const [cards, gminas, ramowy] = await Promise.all([
      listInnovations(ctx.db),
      loadGminas(),
      ramowyPlanIndex(ctx.db),
    ]);
    const innovations: AdaptInnovationOption[] = cards.map((c) => {
      const rp = ramowy.get(c.id);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        categoryLabels: c.categoryLabels,
        areaLabels: c.areas.map((a) => MAPA_AREA_LABEL[a]),
        summary: c.summary,
        badge: !!c.badge,
        ramowyPlan: rp
          ? { callName: rp.callName, sourceUrl: rp.sourceUrl }
          : null,
      };
    });
    const gminaOptions: GminaOption[] = gminas.map((g) => ({
      teryt: g.teryt,
      name: g.name,
      kind: g.kind,
      powiatName: g.powiatName,
      label: gminaLabel(g),
    }));
    return { innovations, gminas: gminaOptions };
  }),

  /**
   * „Poproś ROPS o wsparcie we wdrożeniu" — opens an `adapt` Sprawa with the
   * plan attached. The plan is the institution's own draft (it came back to
   * the browser), so it is redacted and capped like any other text.
   */
  requestSupport: publicProcedure
    .input(
      z.object({
        inputs: planInputSchema,
        markdown: z
          .string()
          .trim()
          .min(50, "Najpierw przygotuj plan.")
          .max(MAX_PLAN_CHARS, "Plan jest za długi."),
        mode: z.enum(["ai", "template"]),
        email: z
          .string()
          .trim()
          .max(200)
          .optional()
          .refine((v) => !v || EMAIL_RE.test(v), {
            message:
              "Podaj adres e-mail, np. osrodek@gmina.pl, albo zostaw puste pole.",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx, "adapt.requestSupport", {
        limit: 5,
        windowSec: 600,
      });
      const [gmina, cards, ramowyIndex] = await Promise.all([
        getGmina(input.inputs.gminaTeryt),
        listInnovations(ctx.db),
        ramowyPlanIndex(ctx.db),
      ]);
      const card = cards.find((c) => c.id === input.inputs.innovationId);
      if (!card || !gmina) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Nie znaleźliśmy innowacji lub gminy. Przygotuj plan ponownie.",
        });
      }
      const ramowy = ramowyIndex.get(card.id);
      const markdown = redactPII(input.markdown).text;
      const needs = input.inputs.needs?.trim()
        ? redactPII(input.inputs.needs.trim()).text
        : null;
      const i = input.inputs;
      const summary = [
        "Instytucja prosi ROPS o wsparcie we wdrożeniu innowacji jako usługi.",
        "",
        `Innowacja: ${card.title}`,
        `Instytucja: ${INSTITUTION_LABEL[i.institution]}`,
        `Gmina: ${gminaLabel(gmina)}, ${gmina.powiatName}`,
        `Zespół: ${STAFF_LABEL[i.staff]}`,
        `Budżet: ${BUDGET_LABEL[i.budget]} (do weryfikacji)`,
        `Czas realizacji: ${TIMEFRAME_LABEL[i.timeframe]}`,
        `Planowana liczba odbiorców: ${i.groupSize ?? "nie podano"}`,
        needs ? `Potrzeby instytucji: ${needs}` : null,
        ramowy
          ? "ROPS ma już Ramowy Plan Wdrożenia tej innowacji (Usługa Wrażliwa)."
          : null,
        `Plan przygotowano: ${input.mode === "ai" ? "z pomocą Asystenta AI" : "z szablonu (bez AI)"}.`,
        "",
        "--- Projekt planu (pełna wersja w danych sprawy) ---",
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
        title: `Wdrożenie: ${card.title} — ${gmina.name}`.slice(0, 200),
        body,
        gminaTeryt: gmina.teryt,
        powiatTeryt: gmina.powiatTeryt,
        areas: card.areas,
        authorRole: INSTITUTION_AUTHOR_ROLE[i.institution],
        contactPref: input.email ? "email" : "none",
        contact: input.email ?? undefined,
        innovationId: card.id,
        callId: ramowy?.callId,
        plan: {
          markdown,
          mode: input.mode,
          inputs: { ...i, needs },
          innovationTitle: card.title,
          gminaName: gmina.name,
          ramowyPlan: ramowy ?? null,
          submittedAt: new Date().toISOString(),
        },
      });
      return { code: res.code, accessToken: res.accessToken };
    }),
});
