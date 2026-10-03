import "server-only";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { innovations } from "~/server/db/schema";
import { buildCatalog, toLibraryCard, type Catalog } from "./core";

/**
 * Published library cards + their MiniSearch index, built once per server
 * instance. The admin editor calls `invalidateLibraryCache()` after a publish;
 * a short TTL covers the other instances of a serverless deployment.
 */
const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; catalog: Promise<Catalog> } | null = null;

async function load(): Promise<Catalog> {
  const rows = await db.select().from(innovations).where(eq(innovations.status, "published"));
  return buildCatalog(rows.map(toLibraryCard));
}

export function getLibrary(): Promise<Catalog> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const catalog = load().catch((e: unknown) => {
      cache = null;
      throw e;
    });
    cache = { at: Date.now(), catalog };
  }
  return cache.catalog;
}

/** Call after any change to jd_innovation (publish, edit, unpublish). */
export function invalidateLibraryCache(): void {
  cache = null;
}
