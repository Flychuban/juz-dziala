import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { anonymiseAuthors } from "../../../scripts/lib/authors";
import { extractKeywords } from "../../../scripts/lib/keywords";
import {
  INNOVATION_STATUS,
  mapaAreaSchema,
  SECTION_KEYS,
  type SectionKey,
} from "~/lib/domain";
import { type Db } from "~/server/db";
import { auditLog, innovations } from "~/server/db/schema";
import { redactPII } from "~/server/domain/redact";
import { notify } from "~/server/notify";
import { afterLibraryChange } from "./library-cache";
import { rederiveSentences } from "./sentences";

const sectionsSchema = z.object(
  Object.fromEntries(
    SECTION_KEYS.map((k) => [k, z.string().max(8000)]),
  ) as Record<SectionKey, z.ZodString>,
);

const youtubeOrEmpty = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) =>
      v === "" ||
      /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//.test(
        v,
      ),
    "Podaj adres filmu z YouTube (https://www.youtube.com/… lub https://youtu.be/…).",
  );

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\/\S+$/.test(v), "Podaj pełny adres (https://…).");

/** Editable fields of a card (staff editor and „Dodaj z dokumentu"). */
export const innovationInputSchema = z.object({
  title: z.string().trim().min(3, "Tytuł jest za krótki.").max(200),
  sections: sectionsSchema,
  mapaAreas: z.array(mapaAreaSchema).max(8),
  categories: z.array(z.string().trim().max(120)).max(12).default([]),
  keywords: z.array(z.string().trim().min(2).max(60)).max(20),
  videoUrl: youtubeOrEmpty,
  testingOpen: z.boolean(),
  status: z.enum(INNOVATION_STATUS),
});
export type InnovationInput = z.infer<typeof innovationInputSchema>;

export const newInnovationSchema = innovationInputSchema.extend({
  sourceUrl: httpUrl,
  licence: z.string().trim().max(120).optional(),
});
export type NewInnovationInput = z.infer<typeof newInnovationSchema>;

type Row = typeof innovations.$inferSelect;

/** The author section keeps organisations and drops private persons (no personal data). */
function cleanSections(sections: Record<SectionKey, string>) {
  const out = {} as Record<SectionKey, string>;
  for (const k of SECTION_KEYS) {
    const text = (sections[k] ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    out[k] = k === "authors" ? anonymiseAuthors(text).text : text;
  }
  return out;
}

const uniq = (xs: string[]) => [
  ...new Set(xs.map((x) => x.trim()).filter(Boolean)),
];

/** Field-level diff for the audit log: only what changed, before and after. */
function diffOf(before: Partial<Row>, after: Partial<Row>) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const scalar = ["title", "videoUrl", "testingOpen", "status"] as const;
  for (const k of scalar) {
    if (before[k] !== after[k])
      diff[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  const arrays = ["mapaAreas", "categories", "keywords"] as const;
  for (const k of arrays) {
    const a = JSON.stringify(before[k] ?? []);
    const b = JSON.stringify(after[k] ?? []);
    if (a !== b) diff[k] = { from: before[k] ?? [], to: after[k] ?? [] };
  }
  for (const k of SECTION_KEYS) {
    const a = before.sections?.[k] ?? "";
    const b = after.sections?.[k] ?? "";
    if (a !== b) diff[`sections.${k}`] = { from: a, to: b };
  }
  return diff;
}

export type SaveResult = {
  slug: string;
  status: Row["status"];
  changed: string[];
  sentences: { kept: number; added: number; removed: number };
  published: boolean;
};

/** Saves an edited card: re-derives sentences, audits the diff, refreshes caches. */
export async function saveInnovation(
  db: Db,
  actor: string,
  id: string,
  input: InnovationInput,
): Promise<SaveResult | null> {
  const [before] = await db
    .select()
    .from(innovations)
    .where(eq(innovations.id, id));
  if (!before) return null;

  const sections = cleanSections(input.sections);
  const re = rederiveSentences(id, before.sentences, sections);
  const keywords = uniq(
    input.keywords.length
      ? input.keywords
      : extractKeywords(input.title, sections),
  );
  const after = {
    title: input.title.trim(),
    sections,
    sentences: re.sentences,
    mapaAreas: [...new Set(input.mapaAreas)],
    ...(await categoriesWithLabels(db, input.categories)),
    keywords,
    videoUrl: input.videoUrl || null,
    testingOpen: input.testingOpen,
    status: input.status,
  };
  const diff = diffOf(before, after);
  const published =
    input.status === "published" && before.status !== "published";

  // The cached „tekst łatwy" was written from the old text: drop it so it is
  // rewritten from the edited card on the next request.
  const contentChanged = Object.keys(diff).some(
    (k) => k === "title" || k.startsWith("sections."),
  );
  await db
    .update(innovations)
    .set({
      ...after,
      ...(contentChanged ? { easyText: null } : {}),
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .where(eq(innovations.id, id));
  await db.insert(auditLog).values({
    actor,
    action: published ? "innovation.publish" : "innovation.update",
    entity: "innovation",
    entityId: id,
    diff: {
      ...diff,
      sentences: {
        kept: re.kept,
        added: re.added,
        removed: re.removed,
      },
    },
  });
  await afterLibraryChange(before.slug);
  if (published)
    await notify({ type: "innovation.published", innovationId: id });

  return {
    slug: before.slug,
    status: input.status,
    changed: Object.keys(diff),
    sentences: {
      kept: re.kept,
      added: re.added.length,
      removed: re.removed.length,
    },
    published,
  };
}

/** „Żłobek dla seniorów" → „zlobek-dla-seniorow". */
export function slugify(title: string): string {
  return (
    title
      .replace(/[łŁ]/g, "l")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "innowacja"
  );
}

/** Creates a new card (always a draft unless staff choose otherwise). */
export async function createInnovation(
  db: Db,
  actor: string,
  input: NewInnovationInput,
): Promise<{ id: string; slug: string }> {
  const existing = await db
    .select({ id: innovations.id, slug: innovations.slug })
    .from(innovations)
    .orderBy(asc(innovations.id));
  const maxN = existing.reduce((m, r) => {
    const n = Number(/^c(\d+)$/.exec(r.id)?.[1] ?? 0);
    return n > m ? n : m;
  }, 0);
  const id = `c${String(maxN + 1).padStart(3, "0")}`;
  const slugs = new Set(existing.map((r) => r.slug));
  const base = slugify(input.title);
  let slug = base;
  for (let i = 2; slugs.has(slug); i++) slug = `${base}-${i}`;

  const sections = cleanSections(
    Object.fromEntries(
      SECTION_KEYS.map((k) => [k, redactPII(input.sections[k] ?? "").text]),
    ) as Record<SectionKey, string>,
  );
  const re = rederiveSentences(id, [], sections);
  const licence = input.licence?.trim() ?? "";
  await db.insert(innovations).values({
    id,
    slug,
    title: input.title.trim(),
    ...(await categoriesWithLabels(db, input.categories)),
    mapaAreas: [...new Set(input.mapaAreas)],
    keywords: uniq(
      input.keywords.length
        ? input.keywords
        : extractKeywords(input.title, sections),
    ),
    sections,
    sentences: re.sentences,
    videoUrl: input.videoUrl || null,
    licence: licence || null,
    licenceUrl: /cc by 4\.0/i.test(licence)
      ? "https://creativecommons.org/licenses/by/4.0/deed.pl"
      : null,
    status: input.status,
    testingOpen: input.testingOpen,
    sourceUrl: input.sourceUrl,
    capturedAt: new Date(),
    updatedBy: actor,
  });
  await db.insert(auditLog).values({
    actor,
    action: "innovation.create",
    entity: "innovation",
    entityId: id,
    diff: {
      title: input.title,
      status: input.status,
      sourceUrl: input.sourceUrl,
    },
  });
  await afterLibraryChange(slug);
  if (input.status === "published")
    await notify({ type: "innovation.published", innovationId: id });
  return { id, slug };
}

/** Keeps `categories` and `categoryLabels` aligned; unknown slugs are dropped. */
async function categoriesWithLabels(db: Db, slugs: string[]) {
  const known = new Map(
    (await categoryLabels(db)).map((c) => [c.slug, c.label] as const),
  );
  const categories = uniq(slugs).filter((s) => known.has(s));
  return {
    categories,
    categoryLabels: categories.map((s) => known.get(s)!),
  };
}

/** Category slug → label, from the cards already in the library. */
export async function categoryLabels(db: Db) {
  const rows = await db.execute<{ slug: string; label: string }>(sql`
    select distinct c.slug, c.label
    from ${innovations},
      lateral unnest(${innovations.categories}, ${innovations.categoryLabels}) as c(slug, label)
    where c.label is not null
    order by c.label`);
  return [...rows];
}
