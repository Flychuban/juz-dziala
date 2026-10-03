import "server-only";

import { and, arrayOverlaps, gte, inArray, ne, sql } from "drizzle-orm";

import type { Db } from "~/server/db";
import { calls, innovationSites, matchRuns, orgs, people } from "~/server/db/schema";
import type { LibraryCard, MapaArea } from "~/server/domain/types";
import { callInnovations } from "./data-files";
import { buildPath, type Path } from "./path";

export type { Path, PathFunding, PathHelper, PathSite } from "./path";

/** Reads the rows behind „Twoja ścieżka" for the shown cards, in four parallel queries. */
export async function loadPaths(db: Db, cards: readonly LibraryCard[]): Promise<Map<string, Path>> {
  const out = new Map<string, Path>();
  if (cards.length === 0) return out;
  const ids = cards.map((c) => c.id);
  const [siteRows, orgRows, callRows, peopleRows] = await Promise.all([
    db.select().from(innovationSites).where(inArray(innovationSites.innovationId, ids)),
    db.select().from(orgs).where(arrayOverlaps(orgs.innovationIds, ids)),
    db.select().from(calls),
    db.select().from(people).where(inArray(people.role, ["mentor", "expert"])),
  ]);
  const rows = { sites: siteRows, orgs: orgRows, people: peopleRows, calls: callRows, listedIn: callInnovations() };
  for (const card of cards) out.set(card.id, buildPath(card, rows));
  return out;
}

export type Similar = {
  days: number;
  count: number;
  /** Of those, how many came from the resident's powiat (null when no gmina was picked). */
  powiatCount: number | null;
  powiatName: string | null;
};

/** Other runs in the same Mapa area in the last 30 days (and how many in the same powiat). */
export async function similarRuns(
  db: Db,
  opts: { runId: string; area: MapaArea | undefined; powiatTeryt: string | null; powiatName: string | null },
): Promise<Similar | null> {
  if (!opts.area) return null;
  const days = 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const powiat = opts.powiatTeryt;
  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
      powiatCount: powiat
        ? sql<number>`(count(*) filter (where ${matchRuns.powiatTeryt} = ${powiat}))::int`
        : sql<number>`0`,
    })
    .from(matchRuns)
    .where(and(gte(matchRuns.createdAt, since), ne(matchRuns.id, opts.runId), arrayOverlaps(matchRuns.areas, [opts.area])));
  const row = rows[0];
  return {
    days,
    count: row?.count ?? 0,
    powiatCount: powiat ? (row?.powiatCount ?? 0) : null,
    powiatName: powiat ? opts.powiatName : null,
  };
}
