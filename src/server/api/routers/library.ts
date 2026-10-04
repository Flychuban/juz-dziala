import { and, arrayContains, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  MAPA_AREAS,
  mapaAreaSchema,
  SECTION_KEYS,
  type MapaArea,
  type SectionKey,
} from "~/lib/domain";
import { EASY_TEXT_SYSTEM, easyTextUser } from "~/server/ai/prompts/easy-text";
import { aiAvailable, aiStructured, userData } from "~/server/ai/structured";
import {
  createTRPCRouter,
  publicProcedure,
  rateLimit,
  type Context,
} from "~/server/api/trpc";
import { type Db } from "~/server/db";
import {
  innovations,
  innovationSites,
  orgs,
  type CardSentence,
} from "~/server/db/schema";
import {
  easyTextProblem,
  tidyEasyText,
} from "~/server/library/easy-text-check";
import {
  freshEnglish,
  localizeCard,
  type ContentLang,
} from "~/server/library/english";
import {
  fold,
  prefixRe,
  queryStems,
  queryWords,
} from "~/server/library/search";
import { gminaByTeryt } from "~/server/match/data-files";

export { queryStems };

/**
 * The first sentence of „Na czym polega rozwiązanie?". When that sentence
 * is only a lead-in („… polega na:") or very short, the following sentences
 * are added until the summary can stand on its own.
 */
export function firstSentence(
  sentences: CardSentence[],
  sections: Record<SectionKey, string>,
): string {
  let parts = sentences
    .filter((x) => x.section === "solution")
    .map((x) => x.text.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    parts = (sections.solution ?? "")
      .trim()
      .split(/(?<=[.!?…])\s+/u)
      .filter(Boolean);
  }
  let out = "";
  for (const p of parts) {
    out = out ? `${out} ${p}` : p;
    if (out.length >= 80 && !/[:;,]$/.test(out)) break;
  }
  return out;
}

const listInput = z
  .object({
    q: z.string().trim().max(200).optional(),
    area: mapaAreaSchema.optional(),
    /** Category slug, e.g. "dla-seniorow". */
    category: z.string().trim().max(120).optional(),
    hasVideo: z.boolean().optional(),
    /** "all" (default): every word must match; "any": at least one, ranked by how many. */
    match: z.enum(["all", "any"]).optional(),
  })
  .optional();

export type LibraryListInput = NonNullable<z.infer<typeof listInput>>;

/** One card in a list: enough for InnovationCard, nothing more. */
export type LibraryListItem = {
  id: string;
  slug: string;
  title: string;
  areas: MapaArea[];
  categories: string[];
  categoryLabels: string[];
  summary: string;
  videoUrl: string | null;
  badge: string | null;
  /** Language of title and summary: "pl" when no fresh English version exists. */
  lang: ContentLang;
};

/**
 * Published cards, filtered and (with `q`) ranked. The library is ~114
 * cards, so search runs in memory: diacritic-insensitive, word-prefix
 * matching, every word must match; title > keywords > body. With
 * `locale: "en"` the cards come back in English (where a fresh translation
 * exists) and a word matches the English text or the Polish original.
 */
export async function listInnovations(
  db: Db,
  input: LibraryListInput = {},
  locale = "pl",
): Promise<LibraryListItem[]> {
  const where = [eq(innovations.status, "published")];
  if (input.area)
    where.push(arrayContains(innovations.mapaAreas, [input.area]));
  if (input.category)
    where.push(arrayContains(innovations.categories, [input.category]));

  const rows = await db
    .select({
      id: innovations.id,
      slug: innovations.slug,
      title: innovations.title,
      mapaAreas: innovations.mapaAreas,
      categories: innovations.categories,
      categoryLabels: innovations.categoryLabels,
      keywords: innovations.keywords,
      sections: innovations.sections,
      sentences: innovations.sentences,
      videoUrl: innovations.videoUrl,
      badge: innovations.badge,
      en: innovations.en,
    })
    .from(innovations)
    .where(and(...where));

  const pool = (input.hasVideo ? rows.filter((r) => !!r.videoUrl) : rows).map(
    (row) => ({ row, view: localizeCard(row, locale) }),
  );

  const qWords = queryWords(input.q, locale);
  const collator = locale === "en" ? "en" : "pl";

  let ordered: typeof pool;
  if (qWords.length > 0) {
    const any = input.match === "any";
    const patterns = qWords.map((w) => ({
      pl: prefixRe(w.pl),
      en: w.en ? prefixRe(w.en) : null,
    }));
    const fieldsOf = (c: {
      title: string;
      keywords: string[];
      categoryLabels: string[];
      sections: Record<SectionKey, string>;
    }) => ({
      title: fold(c.title),
      kw: fold(c.keywords.join(" | ")),
      body: fold(
        `${c.categoryLabels.join(" ")} ${SECTION_KEYS.map((k) => c.sections[k] ?? "").join(" ")}`,
      ),
    });
    const scored: {
      item: (typeof pool)[number];
      hits: number;
      score: number;
    }[] = [];
    for (const item of pool) {
      const pl = fieldsOf(item.row);
      const en = item.view.lang === "en" ? fieldsOf(item.view) : null;
      const weigh = (re: RegExp, f: ReturnType<typeof fieldsOf>) =>
        (re.test(f.title) ? 6 : 0) +
        (re.test(f.kw) ? 3 : 0) +
        (re.test(f.body) ? 1 : 0);
      let score = 0;
      let hits = 0;
      for (const p of patterns) {
        const s = Math.max(weigh(p.pl, pl), p.en && en ? weigh(p.en, en) : 0);
        if (s > 0) hits++;
        score += s;
      }
      if (any ? hits > 0 : hits === patterns.length)
        scored.push({ item, hits, score });
    }
    scored.sort(
      (a, b) =>
        b.hits - a.hits ||
        b.score - a.score ||
        a.item.view.title.localeCompare(b.item.view.title, collator),
    );
    ordered = scored.map((s) => s.item);
  } else {
    ordered = [...pool].sort((a, b) =>
      a.view.title.localeCompare(b.view.title, collator),
    );
  }

  return ordered.map(({ row: r, view }) => ({
    id: r.id,
    slug: r.slug,
    title: view.title,
    areas: r.mapaAreas,
    categories: r.categories,
    categoryLabels: view.categoryLabels,
    summary: firstSentence(view.sentences, view.sections),
    videoUrl: r.videoUrl,
    badge: view.badge,
    lang: view.lang,
  }));
}

/** Counts per Mapa area (all 8, zeros included) and per category. */
export async function libraryFacets(db: Db, locale = "pl") {
  const rows = await db
    .select({
      mapaAreas: innovations.mapaAreas,
      categories: innovations.categories,
      categoryLabels: innovations.categoryLabels,
      videoUrl: innovations.videoUrl,
      en: innovations.en,
    })
    .from(innovations)
    .where(eq(innovations.status, "published"));

  const areaCounts = Object.fromEntries(
    MAPA_AREAS.map((a) => [a, 0]),
  ) as Record<MapaArea, number>;
  const cats = new Map<
    string,
    { slug: string; label: string; count: number }
  >();
  let withVideo = 0;
  for (const r of rows) {
    for (const a of r.mapaAreas) if (a in areaCounts) areaCounts[a]++;
    const labels =
      locale === "en" &&
      r.en?.categoryLabels?.length === r.categoryLabels.length
        ? r.en.categoryLabels
        : r.categoryLabels;
    r.categories.forEach((slug, i) => {
      const label = labels[i] ?? slug;
      const c = cats.get(slug) ?? { slug, label, count: 0 };
      c.count++;
      cats.set(slug, c);
    });
    if (r.videoUrl) withVideo++;
  }
  return {
    total: rows.length,
    withVideo,
    areas: MAPA_AREAS.map((key) => ({ key, count: areaCounts[key] })),
    categories: [...cats.values()].sort((a, b) =>
      a.label.localeCompare(b.label, locale === "en" ? "en" : "pl"),
    ),
  };
}

export type LibraryFacets = Awaited<ReturnType<typeof libraryFacets>>;

/** Biblioteka Innowacji Społecznych — public read API (module II). */
export const libraryRouter = createTRPCRouter({
  /** Published cards; filters: q (search), area, category (slug), hasVideo; match all/any words. */
  list: publicProcedure
    .input(listInput)
    .query(({ ctx, input }) =>
      listInnovations(ctx.db, input ?? {}, ctx.locale),
    ),

  /**
   * One published card + sentences, sites („Działa już w") and organisations
   * (with their place when known); null if absent. `view` is the card in the
   * visitor's language (Polish when no fresh translation exists).
   */
  bySlug: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.db.query.innovations.findFirst({
        where: and(
          eq(innovations.slug, input.slug),
          eq(innovations.status, "published"),
        ),
      });
      if (!card) return null;
      const [sites, cardOrgs] = await Promise.all([
        ctx.db
          .select()
          .from(innovationSites)
          .where(eq(innovationSites.innovationId, card.id)),
        ctx.db
          .select()
          .from(orgs)
          .where(arrayContains(orgs.innovationIds, [card.id])),
      ]);
      const view = localizeCard(card, ctx.locale);
      return {
        ...card,
        summary: firstSentence(card.sentences, card.sections),
        view: {
          ...view,
          summary: firstSentence(view.sentences, view.sections),
        },
        /** An English version exists but was made from an older Polish text. */
        enStale: ctx.locale === "en" && !!card.en && !freshEnglish(card),
        sites,
        orgs: cardOrgs.map((o) => ({
          ...o,
          place:
            gminaByTeryt(o.gminaTeryt)?.name ??
            sites.find((s) => s.orgId === o.id)?.place ??
            null,
        })),
      };
    }),

  /** Counts per Mapa area and per category, plus total and with-video. */
  facets: publicProcedure.query(({ ctx }) => libraryFacets(ctx.db, ctx.locale)),

  /**
   * „Tekst łatwy do czytania" for a published card, in the visitor's
   * language: the cached `innovations.easyText` (Polish) or `easyTextEn`
   * (English) when present, otherwise an AI rewrite (ETR, ≤ ~120 words, no
   * facts beyond the card) that is checked, stored and returned. `null` when
   * AI is unavailable or the rewrite fails a check.
   */
  easyText: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(200) }))
    .query(({ ctx, input }) => getEasyText(ctx, input.slug)),
});

export type EasyTextResult = {
  text: string;
  /** "cached": stored earlier (or edited by staff); "generated": written now. */
  origin: "cached" | "generated";
} | null;

async function getEasyText(
  ctx: Context,
  slug: string,
): Promise<EasyTextResult> {
  const en = ctx.locale === "en";
  const card = await ctx.db.query.innovations.findFirst({
    where: and(eq(innovations.slug, slug), eq(innovations.status, "published")),
    columns: {
      id: true,
      title: true,
      sections: true,
      easyText: true,
      easyTextEn: true,
    },
  });
  if (!card) return null;
  const cached = (en ? card.easyTextEn : card.easyText)?.trim();
  if (cached) return { text: cached, origin: "cached" };
  if (!aiAvailable()) return null;
  try {
    await rateLimit(ctx, "library.easyText", { limit: 20, windowSec: 600 });
  } catch {
    return null;
  }
  // Always written from the Polish card — the source of truth — so the
  // number check below compares against the original text in both languages.
  const cardText = [
    `Tytuł: ${card.title}`,
    ...SECTION_KEYS.filter((k) => k !== "authors").map(
      (k) => `${k}: ${card.sections[k] ?? ""}`,
    ),
  ].join("\n");
  const res = await aiStructured({
    fn: en ? "library.easyText.en" : "library.easyText",
    schema: z.object({ text: z.string() }),
    system: [{ text: EASY_TEXT_SYSTEM, cache: true }],
    user: easyTextUser(userData("karta", cardText)),
    locale: ctx.locale,
    effort: "low",
    maxTokens: 2000,
  });
  if (!res.ok) return null;
  const text = tidyEasyText(res.data.text);
  const problem = easyTextProblem(text, cardText, ctx.locale);
  if (problem) {
    console.warn(
      `[library.easyText] ${slug} (${ctx.locale}): rejected (${problem})`,
    );
    return null;
  }
  // Never overwrite a version staff saved in the meantime.
  if (en) {
    await ctx.db
      .update(innovations)
      .set({ easyTextEn: text })
      .where(and(eq(innovations.id, card.id), isNull(innovations.easyTextEn)));
  } else {
    await ctx.db
      .update(innovations)
      .set({ easyText: text })
      .where(and(eq(innovations.id, card.id), isNull(innovations.easyText)));
  }
  return { text, origin: "generated" };
}
