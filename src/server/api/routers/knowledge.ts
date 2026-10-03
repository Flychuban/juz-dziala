import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  MAPA_AREA_LABEL,
  MAPA_AREAS,
  mapaAreaSchema,
  type MapaArea,
} from "~/lib/domain";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { libraryFacets, listInnovations } from "./library";

/*
 * Kondycja Małopolski (Mapa Wyzwań Społecznych) and Materiały.
 * Reads data/knowledge.json and data/learn.json (produced by the Data agent).
 * Both are optional: a missing or malformed file yields `available: false`
 * and the pages render an empty state instead of failing.
 */

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
  label: string;
  definition: string | null;
  keyChallenges: string[];
  persona: KnowledgePersona | null;
  figures: KnowledgeFigure[];
  reports: { title: string; url: string | null }[];
  pages: (number | string)[];
};
export type LearnItem = z.infer<typeof learnItemSchema>;

async function readJson(file: string): Promise<unknown> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", file), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** data/knowledge.json, validated leniently; null when missing or unusable. */
export async function loadKnowledge(): Promise<{
  source: KnowledgeSource | null;
  areas: KnowledgeArea[];
} | null> {
  const raw = await readJson("knowledge.json");
  const parsed = knowledgeSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw !== null)
      console.warn("[knowledge] data/knowledge.json has an unexpected shape");
    return null;
  }
  const areas: KnowledgeArea[] = [];
  for (const a of parsed.data.areas) {
    const r = areaSchema.safeParse(a);
    if (!r.success) continue;
    const d = r.data;
    areas.push({
      key: d.key,
      label: d.label?.trim() ?? MAPA_AREA_LABEL[d.key],
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

/** data/learn.json — an array, or {items:[…]}; null when missing. */
export async function loadLearn(): Promise<LearnItem[] | null> {
  const raw = await readJson("learn.json");
  if (raw === null) return null;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  const items: LearnItem[] = [];
  for (const x of list) {
    const r = learnItemSchema.safeParse(x);
    if (r.success) items.push(r.data);
  }
  return items;
}

/** Kondycja Małopolski + Materiały — public read API (module II). */
export const knowledgeRouter = createTRPCRouter({
  /**
   * The 8 Mapa areas, always all 8 (in MAPA_AREAS order), each with its
   * innovation count from the library and — when knowledge.json is present —
   * its definition and first key challenge.
   */
  areas: publicProcedure.query(async ({ ctx }) => {
    const [knowledge, facets] = await Promise.all([
      loadKnowledge(),
      libraryFacets(ctx.db),
    ]);
    const byKey = new Map(knowledge?.areas.map((a) => [a.key, a]) ?? []);
    return {
      available: knowledge !== null && knowledge.areas.length > 0,
      source: knowledge?.source ?? null,
      areas: MAPA_AREAS.map((key) => {
        const k = byKey.get(key);
        return {
          key,
          label: k?.label ?? MAPA_AREA_LABEL[key],
          definition: k?.definition ?? null,
          firstChallenge: k?.keyChallenges[0] ?? null,
          innovationCount: facets.areas.find((a) => a.key === key)?.count ?? 0,
        };
      }),
    };
  }),

  /** One area: its knowledge.json entry (or null) and the library cards in it. */
  area: publicProcedure
    .input(z.object({ key: mapaAreaSchema }))
    .query(async ({ ctx, input }) => {
      const [knowledge, innovations] = await Promise.all([
        loadKnowledge(),
        listInnovations(ctx.db, { area: input.key }),
      ]);
      return {
        key: input.key,
        label: MAPA_AREA_LABEL[input.key],
        source: knowledge?.source ?? null,
        area: knowledge?.areas.find((a) => a.key === input.key) ?? null,
        innovations,
      };
    }),

  /** Materiały (data/learn.json): reports, tools, films, guides. */
  learn: publicProcedure.query(async () => {
    const items = await loadLearn();
    return {
      available: items !== null && items.length > 0,
      items: items ?? [],
    };
  }),
});
