import "server-only";

import { and, gte, inArray, isNull, like, or } from "drizzle-orm";

import { MAPA_AREAS, type MapaArea } from "~/lib/domain";
import type { Db } from "~/server/db";
import { cases, matchRuns } from "~/server/db/schema";
import { kAnonymize, type PowiatNeeds } from "./needs-count";

export const NEEDS_WINDOW_DAYS = 90;

/**
 * Needs reported in a powiat over the last 90 days, by Mapa area: every
 * anonymous search (`jd_match_run`) plus needs and questions filed as a
 * Sprawa directly (a case opened from a search is counted once, via its run).
 * Counts below 5 never leave the server.
 */
export async function powiatNeeds(
  db: Db,
  powiatTeryt: string,
  now = new Date(),
): Promise<PowiatNeeds> {
  const since = new Date(now.getTime() - NEEDS_WINDOW_DAYS * 86_400_000);
  const prefix = `${powiatTeryt.slice(0, 4)}%`;
  const [runs, direct] = await Promise.all([
    db
      .select({ areas: matchRuns.areas, isSample: matchRuns.isSample })
      .from(matchRuns)
      .where(
        and(
          gte(matchRuns.createdAt, since),
          or(
            like(matchRuns.powiatTeryt, prefix),
            like(matchRuns.gminaTeryt, prefix),
          ),
        ),
      ),
    db
      .select({ areas: cases.areas, isSample: cases.isSample })
      .from(cases)
      .where(
        and(
          gte(cases.createdAt, since),
          isNull(cases.matchRunId),
          inArray(cases.kind, ["need", "question"]),
          or(like(cases.powiatTeryt, prefix), like(cases.gminaTeryt, prefix)),
        ),
      ),
  ]);
  const rows = [...runs, ...direct];
  const counts = Object.fromEntries(MAPA_AREAS.map((a) => [a, 0])) as Record<
    MapaArea,
    number
  >;
  for (const r of rows) {
    for (const a of new Set(r.areas)) if (a in counts) counts[a]++;
  }
  return kAnonymize({
    total: rows.length,
    counts,
    includesSample: rows.some((r) => r.isSample),
    since: since.toISOString(),
  });
}
