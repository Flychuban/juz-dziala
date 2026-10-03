import { readFileSync, existsSync } from "node:fs";

import { sql } from "drizzle-orm";

import { db } from "~/server/db";
import { innovations } from "~/server/db/schema";
import type { CardSentence } from "~/server/db/schema";
import type { MapaArea, SectionKey } from "~/lib/domain";

type LibraryCard = {
  id: string;
  slug: string;
  title: string;
  categories: string[];
  categoryLabels: string[];
  sections: Record<SectionKey, string>;
  sentences: CardSentence[];
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

/** Upserts every ingested ROPS library card (data/library.json). Keeps staff edits to status/easyText. */
export async function seedLibrary() {
  const file = "data/library.json";
  if (!existsSync(file)) {
    console.log("[seed] data/library.json missing — skipped");
    return;
  }
  const cards = JSON.parse(readFileSync(file, "utf8")) as LibraryCard[];
  for (const c of cards) {
    const row = {
      id: c.id,
      slug: c.slug,
      title: c.title,
      categories: c.categories,
      categoryLabels: c.categoryLabels,
      mapaAreas: c.mapaAreas,
      keywords: c.keywords,
      sections: c.sections,
      sentences: c.sentences,
      badge: c.badge,
      videoUrl: c.videoUrl,
      folderUrl: c.folderUrl,
      materialsUrl: c.materialsUrl,
      licence: c.licence,
      licenceUrl: c.licenceUrl,
      sourceUrl: c.sourceUrl,
      capturedAt: new Date(c.capturedAt),
      sha256: c.sha256,
    };
    await db
      .insert(innovations)
      .values({ ...row, status: "published" })
      .onConflictDoUpdate({ target: innovations.id, set: { ...row, updatedAt: sql`now()` } });
  }
  console.log(`[seed] library: ${cards.length} cards`);
}
