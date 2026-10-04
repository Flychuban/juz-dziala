import "server-only";

import { and, arrayOverlaps, gte, inArray, ne, sql } from "drizzle-orm";

import type { Db } from "~/server/db";
import { calls, innovationSites, matchRuns, orgs, people } from "~/server/db/schema";
import type { LibraryCard, MapaArea } from "~/server/domain/types";
import { callInnovations, gminaByTeryt } from "./data-files";
import { buildPath, pickGeneralFunding, type Path, type PathFunding } from "./path";

export type { Path, PathFunding, PathMentor, PathRunBy } from "./path";

/**
 * Reads the rows behind „Twoja ścieżka" for the shown cards, in four parallel
 * queries, plus the one general grant call shown under all results.
 */
export async function loadPaths(
  db: Db,
  cards: readonly LibraryCard[],
): Promise<{ paths: Map<string, Path>; general: PathFunding | null }> {
  const paths = new Map<string, Path>();
  const ids = cards.map((c) => c.id);
  const [siteRows, orgRows, callRows, peopleRows] = await Promise.all([
    ids.length > 0 ? db.select().from(innovationSites).where(inArray(innovationSites.innovationId, ids)) : [],
    ids.length > 0 ? db.select().from(orgs).where(arrayOverlaps(orgs.innovationIds, ids)) : [],
    db.select().from(calls),
    ids.length > 0 ? db.select().from(people).where(inArray(people.role, ["mentor", "expert"])) : [],
  ]);
  const callRowsEn = callRows.map((c) => ({ ...c, nameEn: c.en?.name ?? null }));
  const orgRowsPlaced = orgRows.map((o) => ({ ...o, place: gminaByTeryt(o.gminaTeryt)?.name ?? null }));
  const rows = { sites: siteRows, orgs: orgRowsPlaced, people: peopleRows, calls: callRowsEn, listedIn: callInnovations() };
  for (const card of cards) paths.set(card.id, buildPath(card, rows));
  return { paths, general: pickGeneralFunding(callRowsEn) };
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
