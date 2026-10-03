/**
 * The shared data shape every matching module builds against.
 *
 * Pure TypeScript: no Next.js, no database, so it runs in tests, scripts and
 * server code alike. The Data agent produces `data/library.json` in this shape.
 */
import { z } from "zod";

export const MAPA_AREAS = [
  "family",
  "homelessness",
  "disability",
  "poverty",
  "migrants",
  "health",
  "mental_health",
  "seniors",
] as const;
export type MapaArea = (typeof MAPA_AREAS)[number];

export const SECTION_KEYS = [
  "solution",
  "problems",
  "targetGroup",
  "whoCanUse",
  "doesItWork",
  "authors",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export type LibrarySentence = { id: string; section: SectionKey; text: string };

export type LibraryCard = {
  id: string;
  slug: string;
  title: string;
  categories: string[];
  categoryLabels: string[];
  sections: Record<SectionKey, string>;
  /** Sentence ids look like "c042.s3"; they are what the AI cites as evidence. */
  sentences: LibrarySentence[];
  badge: string | null;
  videoUrl: string | null;
  folderUrl: string | null;
  materialsUrl: string | null;
  licence: string | null;
  licenceUrl: string | null;
  mapaAreas: MapaArea[];
  keywords: string[];
  sourceUrl: string;
  capturedAt: string;
  sha256: string;
};

export const mapaAreaSchema = z.enum(MAPA_AREAS);
export const sectionKeySchema = z.enum(SECTION_KEYS);

export const librarySentenceSchema = z.object({
  id: z.string().min(1),
  section: sectionKeySchema,
  text: z.string(),
});

export const libraryCardSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  categories: z.array(z.string()),
  categoryLabels: z.array(z.string()),
  sections: z.object({
    solution: z.string(),
    problems: z.string(),
    targetGroup: z.string(),
    whoCanUse: z.string(),
    doesItWork: z.string(),
    authors: z.string(),
  }),
  sentences: z.array(librarySentenceSchema),
  badge: z.string().nullable(),
  videoUrl: z.string().nullable(),
  folderUrl: z.string().nullable(),
  materialsUrl: z.string().nullable(),
  licence: z.string().nullable(),
  licenceUrl: z.string().nullable(),
  mapaAreas: z.array(mapaAreaSchema),
  keywords: z.array(z.string()),
  sourceUrl: z.string().min(1),
  capturedAt: z.string().min(1),
  sha256: z.string().min(1),
}) satisfies z.ZodType<LibraryCard>;

export function isMapaArea(value: unknown): value is MapaArea {
  return typeof value === "string" && (MAPA_AREAS as readonly string[]).includes(value);
}
