import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Locale } from "~/i18n/config";
import { labelsFor } from "~/lib/domain";
import {
  getGmina,
  gusSourceFor,
  gusSourceGeneral,
  loadGminas,
  ramowyPlanIndex,
} from "~/server/adapt/data";
import { NEEDS_WINDOW_DAYS, powiatNeeds } from "~/server/adapt/needs";
import { canSeeNeeds } from "~/server/adapt/needs-count";
import {
  buildProfile,
  featuredRuralGmina,
  gminaLabel,
  medianShare80,
  powiatShares80,
  profileSignals,
  recommend,
  share,
  type ProfileCard,
} from "~/server/adapt/profile";
import type { Gmina } from "~/server/adapt/types";
import {
  createTRPCRouter,
  publicProcedure,
  roleProcedure,
} from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { innovations } from "~/server/db/schema";
import { firstSentence } from "./library";

/**
 * The profile, the printed rule and the six fitting innovations for one
 * gmina — plus the powiat's (k-anonymous) needs when `withNeeds`. One
 * function, so the featured example on /municipality and
 * /municipality/[teryt] can never disagree about which innovation comes
 * first. Without needs the rule uses GUS figures only, so a public page
 * never reveals (even indirectly) what residents reported.
 */
async function gminaView(
  db: Db,
  gmina: Gmina,
  all: Gmina[],
  opts: { locale: Locale; withNeeds: boolean },
) {
  const { locale } = opts;
  const profile = buildProfile(gmina, all);
  const [needs, rows, ramowy] = await Promise.all([
    opts.withNeeds ? powiatNeeds(db, gmina.powiatTeryt) : null,
    db
      .select({
        id: innovations.id,
        slug: innovations.slug,
        title: innovations.title,
        mapaAreas: innovations.mapaAreas,
        keywords: innovations.keywords,
        sections: innovations.sections,
        sentences: innovations.sentences,
        categoryLabels: innovations.categoryLabels,
        badge: innovations.badge,
        capturedAt: innovations.capturedAt,
        en: innovations.en,
      })
      .from(innovations)
      .where(eq(innovations.status, "published")),
    ramowyPlanIndex(db),
  ]);
  const signals = profileSignals(profile, needs?.areas ?? [], {
    locale,
    windowDays: NEEDS_WINDOW_DAYS,
  });
  // The rule reads the Polish card (the source) in both languages.
  const cards: ProfileCard[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    mapaAreas: r.mapaAreas,
    keywords: r.keywords,
    solution: r.sections.solution ?? "",
    problems: r.sections.problems ?? "",
    badge: r.badge,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const recs = recommend(cards, signals, {
    limit: 6,
    ramowyPlanIds: new Set(ramowy.keys()),
    locale,
  });
  const libraryCapturedAt = rows.reduce<Date | null>(
    (max, r) => (!max || r.capturedAt > max ? r.capturedAt : max),
    null,
  );
  const L = labelsFor(locale);
  return {
    profile,
    needs: needs ? { ...needs, windowDays: NEEDS_WINDOW_DAYS } : null,
    signals,
    libraryCapturedAt,
    recommendations: recs.flatMap((r) => {
      const row = byId.get(r.card.id);
      if (!row) return [];
      const rp = ramowy.get(r.card.id);
      const tr = locale === "en" ? row.en : null;
      return [
        {
          id: r.card.id,
          slug: r.card.slug,
          title: tr?.title ?? r.card.title,
          lang: tr ? ("en" as const) : ("pl" as const),
          areas: r.card.mapaAreas,
          areaLabels: r.card.mapaAreas.map((a) => L.area[a]),
          categoryLabels: tr?.categoryLabels.length
            ? tr.categoryLabels
            : row.categoryLabels,
          summary: tr
            ? firstSentence(
                row.sentences.map((s) => ({
                  ...s,
                  text: tr.sentences[s.id] ?? s.text,
                })),
                { ...row.sections, ...tr.sections },
              )
            : firstSentence(row.sentences, row.sections),
          badge: !!r.card.badge,
          ramowyPlan: rp
            ? { callName: rp.callName, sourceUrl: rp.sourceUrl }
            : null,
          matches: r.matches,
        },
      ];
    }),
  };
}

/** Module VII — „Dla gminy": GUS profile, fitting innovations; needs for staff. */
export const municipalityRouter = createTRPCRouter({
  /** /municipality: every gmina, 80+ share per powiat, a featured example. */
  overview: publicProcedure.query(async ({ ctx }) => {
    const all = await loadGminas();
    const featuredGmina = featuredRuralGmina(all);
    const featured = featuredGmina
      ? await gminaView(ctx.db, featuredGmina, all, {
          locale: ctx.locale,
          withNeeds: false,
        })
      : null;
    return {
      gminas: all.map((g) => ({
        teryt: g.teryt,
        name: g.name,
        kind: g.kind,
        powiatTeryt: g.powiatTeryt,
        powiatName: g.powiatName,
        label: gminaLabel(g, ctx.locale),
        population: g.population,
        share80: share(g.pop80, g.population),
        popChange10y: g.popChange10y,
      })),
      powiatShares80: powiatShares80(all),
      medianShare80: medianShare80(all),
      featured: featured
        ? {
            ...featured.profile,
            top: featured.recommendations.slice(0, 3).map((r) => ({
              slug: r.slug,
              title: r.title,
              lang: r.lang,
              matches: r.matches.map((m) => m.label),
            })),
          }
        : null,
      gus: await gusSourceGeneral(),
    };
  }),

  /**
   * /municipality/[teryt]; null for an unknown TERYT. `needs` is null unless
   * the reader is ROPS or a logged-in gmina.
   */
  profile: publicProcedure
    .input(z.object({ teryt: z.string().trim().regex(/^\d{7}$/) }))
    .query(async ({ ctx, input }) => {
      const [gmina, all] = await Promise.all([
        getGmina(input.teryt),
        loadGminas(),
      ]);
      if (!gmina) return null;
      const [gus, view] = await Promise.all([
        gusSourceFor(gmina),
        gminaView(ctx.db, gmina, all, {
          locale: ctx.locale,
          withNeeds: canSeeNeeds(ctx.staff),
        }),
      ]);
      return { ...view, gus };
    }),

  /**
   * „Panel gminy" (JST login; ROPS may look too): the powiat's anonymised
   * need counts by Mapa area for the gmina the account works for. The demo
   * account is not tied to one gmina, so it works for `teryt` when given,
   * else for the featured example.
   */
  panel: roleProcedure("jst")
    .input(
      z
        .object({ teryt: z.string().trim().regex(/^\d{7}$/).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const all = await loadGminas();
      const gmina =
        (input?.teryt ? all.find((g) => g.teryt === input.teryt) : null) ??
        featuredRuralGmina(all);
      if (!gmina) return null;
      const needs = await powiatNeeds(ctx.db, gmina.powiatTeryt);
      return {
        gmina: {
          teryt: gmina.teryt,
          name: gmina.name,
          kind: gmina.kind,
          powiatTeryt: gmina.powiatTeryt,
          powiatName: gmina.powiatName,
          label: gminaLabel(gmina, ctx.locale),
        },
        needs: { ...needs, windowDays: NEEDS_WINDOW_DAYS },
      };
    }),
});
