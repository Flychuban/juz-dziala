import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  labelsFor,
  MAPA_AREAS,
  mapaAreaSchema,
  type MapaArea,
} from "~/lib/domain";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { regionFigures } from "~/server/knowledge/region";
import { englishKnowledgeJson } from "~/server/match/data-files";
import { libraryFacets, listInnovations } from "./library";

/*
 * Kondycja Małopolski (Mapa Wyzwań Społecznych) and Materiały.
 * Reads data/knowledge.json and data/learn.json (produced by the Data agent),
 * and in English data/knowledge.en.json / data/learn.en.json, which mirror the
 * Polish files. All are optional: a missing or malformed file yields
 * `available: false` (or the Polish original, marked lang "pl") and the pages
 * render an empty state instead of failing. Regional figures („Małopolska w
 * liczbach") come from data/gminas.json — see ~/server/knowledge/region.
 */

/** Language a piece of content is shown in. */
type ContentLang = "pl" | "en";

const str = z.string().trim();
const strList = z
  .array(z.unknown())
  .catch([])
  .transform((xs) =>
    xs.filter((x): x is string => typeof x === "string" && x.trim() !== ""),
  );

/** Source may arrive as a string or an object; normalised to {name,url,date}. */
const sourceSchema = z
  .union([
    z.string(),
    z
      .object({
        name: z.string().optional(),
        title: z.string().optional(),
        url: z.string().optional(),
        href: z.string().optional(),
        capturedAt: z.string().optional(),
        date: z.string().optional(),
        publishedAt: z.string().optional(),
        publisher: z.string().optional(),
      })
      .loose(),
  ])
  .nullish()
  .transform((s) => {
    if (!s) return null;
    if (typeof s === "string") {
      const isUrl = /^https?:\/\//.test(s);
      return {
        name: isUrl ? "Mapa Wyzwań Społecznych" : s,
        url: isUrl ? s : null,
        date: null,
      };
    }
    return {
      name: s.name ?? s.title ?? "Mapa Wyzwań Społecznych",
      url: s.url ?? s.href ?? null,
      date: s.capturedAt ?? s.date ?? s.publishedAt ?? null,
    };
  });

const figureSchema = z
  .object({
    value: z.union([z.string(), z.number()]),
    label: str,
    scope: z.string().nullish(),
    year: z.union([z.number(), z.string()]).nullish(),
    page: z.union([z.number(), z.string()]).nullish(),
  })
  .loose();

const personaSchema = z
  .object({
    name: str,
    age: z.union([z.number(), z.string()]).nullish(),
    description: z.string().nullish(),
    goals: strList,
    challenges: strList,
    motivations: strList,
  })
  .loose();

const reportSchema = z
  .object({ title: str, url: z.string().nullish() })
  .loose();

const areaSchema = z
  .object({
    key: mapaAreaSchema,
    label: z.string().nullish(),
    definition: z.string().nullish(),
    keyChallenges: strList,
    persona: personaSchema.nullish().catch(null),
    figures: z.array(figureSchema.nullable().catch(null)).catch([]),
    reports: z.array(reportSchema.nullable().catch(null)).catch([]),
    pages: z.array(z.union([z.number(), z.string()])).catch([]),
  })
  .loose();

const knowledgeSchema = z
  .object({
    source: sourceSchema,
    areas: z.array(z.unknown()),
  })
  .loose();

const learnItemSchema = z
  .object({
    title: str.min(1),
    kind: z.string().nullish(),
    url: str.min(1),
    description: z.string().nullish(),
    publisher: z.string().nullish(),
  })
  .loose();

export type KnowledgeSource = NonNullable<z.infer<typeof sourceSchema>>;
export type KnowledgeFigure = z.infer<typeof figureSchema>;
export type KnowledgePersona = z.infer<typeof personaSchema>;
export type KnowledgeArea = {
  key: MapaArea;
  /** Language of the prose below ("pl" when no English version exists). */
  lang: ContentLang;
  label: string;
  definition: string | null;
  keyChallenges: string[];
  persona: KnowledgePersona | null;
  figures: KnowledgeFigure[];
  reports: { title: string; url: string | null }[];
  pages: (number | string)[];
};
export type LearnItem = z.infer<typeof learnItemSchema> & { lang: ContentLang };

async function readJson(file: string): Promise<unknown> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", file), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseKnowledgeFile(
  raw: unknown,
  lang: ContentLang,
): { source: KnowledgeSource | null; areas: KnowledgeArea[] } | null {
  const parsed = knowledgeSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw !== null)
      console.warn(
        `[knowledge] knowledge file (${lang}) has an unexpected shape`,
      );
    return null;
  }
  const labels = labelsFor(lang).area;
  const areas: KnowledgeArea[] = [];
  for (const a of parsed.data.areas) {
    const r = areaSchema.safeParse(a);
    if (!r.success) continue;
    const d = r.data;
    areas.push({
      key: d.key,
      lang,
      label: labels[d.key] ?? d.label?.trim() ?? d.key,
      definition: d.definition?.trim() ?? null,
      keyChallenges: d.keyChallenges,
      persona: d.persona ?? null,
      figures: d.figures.filter((f): f is KnowledgeFigure => f !== null),
      reports: d.reports
        .filter((x) => x !== null)
        .map((x) => ({ title: x.title, url: x.url ?? null })),
      pages: d.pages,
    });
  }
  return { source: parsed.data.source, areas };
}

/**
 * data/knowledge.json, validated leniently; null when missing or unusable.
 * In English each area comes from data/knowledge.en.json when it has one
 * (figure values and scopes written the English way), otherwise the Polish
 * area is returned with `lang: "pl"`.
 */
export async function loadKnowledge(locale = "pl"): Promise<{
  source: KnowledgeSource | null;
  areas: KnowledgeArea[];
} | null> {
  const pl = parseKnowledgeFile(await readJson("knowledge.json"), "pl");
  if (!pl || locale !== "en") return pl;
  const en = parseKnowledgeFile(
    englishKnowledgeJson(await readJson("knowledge.en.json")),
    "en",
  );
  if (!en) return pl;
  const byKey = new Map(en.areas.map((a) => [a.key, a]));
  return {
    source: en.source ?? pl.source,
    areas: pl.areas.map((a) => byKey.get(a.key) ?? a),
  };
}

function learnList(raw: unknown): unknown[] {
  return Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
}

/**
 * data/learn.json — an array, or {items:[…]}; null when missing. In English
 * each item comes from data/learn.en.json (matched by its link) when present.
 */
export async function loadLearn(locale = "pl"): Promise<LearnItem[] | null> {
  const raw = await readJson("learn.json");
  if (raw === null) return null;
  const english = new Map<string, z.infer<typeof learnItemSchema>>();
  if (locale === "en") {
    for (const x of learnList(await readJson("learn.en.json"))) {
      const r = learnItemSchema.safeParse(x);
      if (r.success) english.set(r.data.url, r.data);
    }
  }
  const items: LearnItem[] = [];
  for (const x of learnList(raw)) {
    const r = learnItemSchema.safeParse(x);
    if (!r.success) continue;
    const en = english.get(r.data.url);
    // The kind is a key, not prose: always the Polish file's.
    items.push(
      en ? { ...en, kind: r.data.kind, lang: "en" } : { ...r.data, lang: "pl" },
    );
  }
  return items;
}

/** Kondycja Małopolski + Materiały — public read API (module II). */
export const knowledgeRouter = createTRPCRouter({
  /**
   * The 8 Mapa areas, always all 8 (in MAPA_AREAS order), each with its
   * innovation count from the library and — when knowledge.json is present —
   * its definition and first key challenge; plus the regional GUS figures.
   */
  areas: publicProcedure.query(async ({ ctx }) => {
    const [knowledge, facets] = await Promise.all([
      loadKnowledge(ctx.locale),
      libraryFacets(ctx.db),
    ]);
    const byKey = new Map(knowledge?.areas.map((a) => [a.key, a]) ?? []);
    const labels = labelsFor(ctx.locale).area;
    return {
      available: knowledge !== null && knowledge.areas.length > 0,
      source: knowledge?.source ?? null,
      region: regionFigures(),
      areas: MAPA_AREAS.map((key) => {
        const k = byKey.get(key);
        return {
          key,
          lang: k?.lang ?? ctx.locale,
          label: labels[key],
          definition: k?.definition ?? null,
          firstChallenge: k?.keyChallenges[0] ?? null,
          innovationCount: facets.areas.find((a) => a.key === key)?.count ?? 0,
        };
      }),
    };
  }),

  /** One area: its knowledge.json entry (or null), the library cards in it, and the regional GUS figures. */
  area: publicProcedure
    .input(z.object({ key: mapaAreaSchema }))
    .query(async ({ ctx, input }) => {
      const [knowledge, innovations] = await Promise.all([
        loadKnowledge(ctx.locale),
        listInnovations(ctx.db, { area: input.key }, ctx.locale),
      ]);
      return {
        key: input.key,
        label: labelsFor(ctx.locale).area[input.key],
        source: knowledge?.source ?? null,
        area: knowledge?.areas.find((a) => a.key === input.key) ?? null,
        region: regionFigures(),
        innovations,
      };
    }),

  /** Materiały (data/learn.json): reports, tools, films, guides. */
  learn: publicProcedure.query(async ({ ctx }) => {
    const items = await loadLearn(ctx.locale);
    return {
      available: items !== null && items.length > 0,
      items: items ?? [],
    };
  }),
});
