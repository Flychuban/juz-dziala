import { index, uniqueIndex } from "drizzle-orm/pg-core";

import type { InnovationStatus, MapaArea, SectionKey } from "~/lib/domain";
import { createTable } from "./_table";

export type CardSentence = { id: string; section: SectionKey; text: string };

/**
 * English version of a card, translated sentence by sentence with the ids kept
 * (data/library.en.json → seed). A match still quotes the Polish sentence by id;
 * English mode shows `sentences[id]` labelled as a translation. `sourceSha` is
 * the sha256 of the Polish sections it was made from: when staff edit the card,
 * the translation is stale and the Polish original is shown (lang="pl").
 */
export type InnovationEn = {
  title: string;
  sections: Record<SectionKey, string>;
  sentences: Record<string, string>;
  keywords: string[];
  categoryLabels: string[];
  badge?: string | null;
  sourceSha: string;
  translatedAt: string;
};

/** A ROPS library card. `id` is stable ("c001"), assigned at ingest. */
export const innovations = createTable(
  "innovation",
  (d) => ({
    id: d.text().primaryKey(),
    slug: d.text().notNull(),
    title: d.text().notNull(),
    categories: d.text().array().notNull().default([]),
    categoryLabels: d.text().array().notNull().default([]),
    mapaAreas: d.text().array().$type<MapaArea[]>().notNull().default([]),
    keywords: d.text().array().notNull().default([]),
    sections: d.jsonb().$type<Record<SectionKey, string>>().notNull(),
    sentences: d.jsonb().$type<CardSentence[]>().notNull(),
    badge: d.text(),
    videoUrl: d.text(),
    folderUrl: d.text(),
    materialsUrl: d.text(),
    licence: d.text(),
    licenceUrl: d.text(),
    /** Cached „tekst łatwy do czytania" version (AI, reviewed). */
    easyText: d.text(),
    /** English translation (see InnovationEn); null until translated. */
    en: d.jsonb().$type<InnovationEn>(),
    /** Cached easy-to-read text in English. */
    easyTextEn: d.text(),
    status: d.text().$type<InnovationStatus>().notNull().default("published"),
    /** Open for testers in module IV. */
    testingOpen: d.boolean().notNull().default(false),
    sourceUrl: d.text().notNull(),
    capturedAt: d.timestamp({ withTimezone: true }).notNull(),
    sha256: d.text(),
    updatedBy: d.text(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [
    uniqueIndex("innovation_slug_idx").on(t.slug),
    index("innovation_status_idx").on(t.status),
  ],
);
