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
import {
  easyTextProblem,
  tidyEasyText,
} from "~/server/library/easy-text-check";
import { type Db } from "~/server/db";
import {
  innovations,
  innovationSites,
  orgs,
  type CardSentence,
} from "~/server/db/schema";

/** Diacritic- and case-insensitive form (ą→a, ł→l …) for search. */
function fold(text: string) {
  return text
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STOPWORDS = new Set(
  "dla nie jak sie lub oraz jest sa mam mamy moja moj moje ktory ktora ktore przez przy czy ale tak to co ze od do po za na we ze mnie mi jego jej ich tez juz bardzo albo".split(
    " ",
  ),
);

/**
 * Turns a query into folded word stems for prefix matching: Polish
 * inflects word endings, so „samotność" → „samotn" also finds „samotnych",
 * „seniorów" → „senio" finds „seniorzy". Stopwords are dropped.
 */
export function queryStems(q: string | null | undefined): string[] {
  const words = fold(q ?? "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const stems = words.map((t) =>
    t.length > 6
      ? t.slice(0, Math.max(5, t.length - 3))
      : t.length > 4
        ? t.slice(0, -1)
        : t,
  );
  return [...new Set(stems)];
}

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
};

/**
 * Published cards, filtered and (with `q`) ranked. The library is ~114
 * cards, so search runs in memory: diacritic-insensitive, word-prefix
 * matching, every word must match; title > keywords > body.
 */
export async function listInnovations(
  db: Db,
  input: LibraryListInput = {},
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
    })
    .from(innovations)
    .where(and(...where));

  const pool = input.hasVideo ? rows.filter((r) => !!r.videoUrl) : rows;

  const stems = queryStems(input.q);

  let ordered: typeof rows;
  if (stems.length > 0) {
    const any = input.match === "any";
    const patterns = stems.map(
      (t) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(t)}`, "u"),
    );
    const scored: {
      row: (typeof rows)[number];
      hits: number;
      score: number;
    }[] = [];
    for (const row of pool) {
      const title = fold(row.title);
      const kw = fold(row.keywords.join(" | "));
      const body = fold(
        `${row.categoryLabels.join(" ")} ${SECTION_KEYS.map((k) => row.sections[k] ?? "").join(" ")}`,
      );
      let score = 0;
      let hits = 0;
      for (const re of patterns) {
        const s =
          (re.test(title) ? 6 : 0) +
          (re.test(kw) ? 3 : 0) +
          (re.test(body) ? 1 : 0);
        if (s > 0) hits++;
        score += s;
      }
      if (any ? hits > 0 : hits === patterns.length)
        scored.push({ row, hits, score });
    }
    scored.sort(
      (a, b) =>
        b.hits - a.hits ||
        b.score - a.score ||
        a.row.title.localeCompare(b.row.title, "pl"),
    );
    ordered = scored.map((s) => s.row);
  } else {
    ordered = [...pool].sort((a, b) => a.title.localeCompare(b.title, "pl"));
  }

  return ordered.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    areas: r.mapaAreas,
    categories: r.categories,
    categoryLabels: r.categoryLabels,
    summary: firstSentence(r.sentences, r.sections),
    videoUrl: r.videoUrl,
    badge: r.badge,
  }));
}

/** Counts per Mapa area (all 8, zeros included) and per category. */
export async function libraryFacets(db: Db) {
  const rows = await db
    .select({
      mapaAreas: innovations.mapaAreas,
      categories: innovations.categories,
      categoryLabels: innovations.categoryLabels,
      videoUrl: innovations.videoUrl,
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
    r.categories.forEach((slug, i) => {
      const label = r.categoryLabels[i] ?? slug;
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
      a.label.localeCompare(b.label, "pl"),
    ),
  };
}

export type LibraryFacets = Awaited<ReturnType<typeof libraryFacets>>;

/** Biblioteka Innowacji Społecznych — public read API (module II). */
export const libraryRouter = createTRPCRouter({
  /** Published cards; filters: q (search), area, category (slug), hasVideo; match all/any words. */
  list: publicProcedure
    .input(listInput)
    .query(({ ctx, input }) => listInnovations(ctx.db, input ?? {})),

  /** One published card + sentences, sites („Działa już w") and organisations; null if absent. */
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
      return {
        ...card,
        summary: firstSentence(card.sentences, card.sections),
        sites,
        orgs: cardOrgs,
      };
    }),

  /** Counts per Mapa area and per category, plus total and with-video. */
  facets: publicProcedure.query(({ ctx }) => libraryFacets(ctx.db)),

  /**
   * „Tekst łatwy do czytania" for a published card: the cached
   * `innovations.easyText` when present, otherwise an AI rewrite (ETR,
   * ≤ ~120 words, no facts beyond the card) that is checked, stored and
   * returned. `null` when AI is unavailable or the rewrite fails a check.
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

async function getEasyText(ctx: Context, slug: string): Promise<EasyTextResult> {
  const card = await ctx.db.query.innovations.findFirst({
    where: and(eq(innovations.slug, slug), eq(innovations.status, "published")),
    columns: { id: true, title: true, sections: true, easyText: true },
  });
  if (!card) return null;
  if (card.easyText?.trim()) return { text: card.easyText.trim(), origin: "cached" };
  if (!aiAvailable()) return null;
  try {
    await rateLimit(ctx, "library.easyText", { limit: 20, windowSec: 600 });
  } catch {
    return null;
  }
  const cardText = [
    `Tytuł: ${card.title}`,
    ...SECTION_KEYS.filter((k) => k !== "authors").map(
      (k) => `${k}: ${card.sections[k] ?? ""}`,
    ),
  ].join("\n");
  const res = await aiStructured({
    fn: "library.easyText",
    schema: z.object({ text: z.string() }),
    system: [{ text: EASY_TEXT_SYSTEM, cache: true }],
    user: easyTextUser(userData("karta", cardText)),
    effort: "low",
    maxTokens: 2000,
  });
  if (!res.ok) return null;
  const text = tidyEasyText(res.data.text);
  const problem = easyTextProblem(text, cardText);
  if (problem) {
    console.warn(`[library.easyText] ${slug}: rejected (${problem})`);
    return null;
  }
  // Never overwrite a version staff saved in the meantime.
  await ctx.db
    .update(innovations)
    .set({ easyText: text })
    .where(and(eq(innovations.id, card.id), isNull(innovations.easyText)));
  return { text, origin: "generated" };
}
