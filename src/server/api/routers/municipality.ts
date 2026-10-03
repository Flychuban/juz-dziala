import { eq } from "drizzle-orm";
import { z } from "zod";

import { MAPA_AREA_LABEL } from "~/lib/domain";
import {
  getGmina,
  gusSourceFor,
  gusSourceGeneral,
  loadGminas,
  ramowyPlanIndex,
} from "~/server/adapt/data";
import { NEEDS_WINDOW_DAYS, powiatNeeds } from "~/server/adapt/needs";
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
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { innovations } from "~/server/db/schema";
import { firstSentence } from "./library";

/** Module VII — „Dla gminy": GUS profile, k-anonymous needs, fitting innovations. */
export const municipalityRouter = createTRPCRouter({
  /** /municipality: every gmina, 80+ share per powiat, a featured example. */
  overview: publicProcedure.query(async () => {
    const all = await loadGminas();
    const featured = featuredRuralGmina(all);
    return {
      gminas: all.map((g) => ({
        teryt: g.teryt,
        name: g.name,
        kind: g.kind,
        powiatTeryt: g.powiatTeryt,
        powiatName: g.powiatName,
        label: gminaLabel(g),
        population: g.population,
        share80: share(g.pop80, g.population),
        popChange10y: g.popChange10y,
      })),
      powiatShares80: powiatShares80(all),
      medianShare80: medianShare80(all),
      featured: featured ? buildProfile(featured, all) : null,
      gus: await gusSourceGeneral(),
    };
  }),

  /** /municipality/[teryt]; null for an unknown TERYT. */
  profile: publicProcedure
    .input(z.object({ teryt: z.string().trim().regex(/^\d{7}$/) }))
    .query(async ({ ctx, input }) => {
      const [gmina, all] = await Promise.all([
        getGmina(input.teryt),
        loadGminas(),
      ]);
      if (!gmina) return null;
      const profile = buildProfile(gmina, all);
      const [gus, needs, rows, ramowy] = await Promise.all([
        gusSourceFor(gmina),
        powiatNeeds(ctx.db, gmina.powiatTeryt),
        ctx.db
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
          })
          .from(innovations)
          .where(eq(innovations.status, "published")),
        ramowyPlanIndex(ctx.db),
      ]);
      const signals = profileSignals(profile, needs.areas);
      const cards: ProfileCard[] = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        mapaAreas: r.mapaAreas,
        keywords: r.keywords,
        solution: r.sections.solution ?? "",
        badge: r.badge,
      }));
      const byId = new Map(rows.map((r) => [r.id, r]));
      const recs = recommend(cards, signals, {
        limit: 6,
        ramowyPlanIds: new Set(ramowy.keys()),
      });
      const libraryCapturedAt = rows.reduce<Date | null>(
        (max, r) => (!max || r.capturedAt > max ? r.capturedAt : max),
        null,
      );
      return {
        profile,
        gus,
        needs: { ...needs, windowDays: NEEDS_WINDOW_DAYS },
        signals,
        libraryCapturedAt,
        recommendations: recs.flatMap((r) => {
          const row = byId.get(r.card.id);
          if (!row) return [];
          const rp = ramowy.get(r.card.id);
          return [
            {
              id: r.card.id,
              slug: r.card.slug,
              title: r.card.title,
              areas: r.card.mapaAreas,
              areaLabels: r.card.mapaAreas.map((a) => MAPA_AREA_LABEL[a]),
              categoryLabels: row.categoryLabels,
              summary: firstSentence(row.sentences, row.sections),
              badge: !!r.card.badge,
              ramowyPlan: rp
                ? { callName: rp.callName, sourceUrl: rp.sourceUrl }
                : null,
              matches: r.matches,
            },
          ];
        }),
      };
    }),
});
