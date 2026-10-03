import "server-only";

import { and, arrayOverlaps, gte, inArray, ne, sql } from "drizzle-orm";

import type { CallStatus } from "~/lib/domain";
import type { Db } from "~/server/db";
import { calls, innovationSites, matchRuns, orgs, people } from "~/server/db/schema";
import type { LibraryCard, MapaArea } from "~/server/domain/types";
import { powiatName } from "./data-files";

/**
 * „Twoja ścieżka" for each card: Działa już w → Kto pomoże → Skąd pieniądze.
 * Only what the database holds; empty steps are shown as such, never filled in.
 */
export type PathSite = { place: string; stage: string; isSample: boolean; sourceUrl: string | null };
export type PathHelper = {
  name: string;
  kind: "org" | "mentor" | "author";
  detail: string | null;
  isSample: boolean;
  sourceUrl: string | null;
};
export type PathFunding = {
  id: string;
  name: string;
  program: string | null;
  status: CallStatus;
  windowTo: string | null;
  sourceUrl: string | null;
};
export type Path = { sites: PathSite[]; helpers: PathHelper[]; funding: PathFunding[] };

const STATUS_ORDER: Record<CallStatus, number> = { open: 0, planned: 1, demo: 2, closed: 3 };
const USLUGA_WRAZLIWA = /us[łl]ug[aię]\s+wra[żz]liw/iu;

function authorsLine(card: LibraryCard): string | null {
  const a = card.sections.authors.replace(/\s+/gu, " ").trim();
  if (!a) return null;
  return a.length > 160 ? `${a.slice(0, 159)}…` : a;
}

export async function loadPaths(db: Db, cards: readonly LibraryCard[]): Promise<Map<string, Path>> {
  const out = new Map<string, Path>();
  if (cards.length === 0) return out;
  const ids = cards.map((c) => c.id);
  const [siteRows, orgRows, callRows, peopleRows] = await Promise.all([
    db.select().from(innovationSites).where(inArray(innovationSites.innovationId, ids)),
    db.select().from(orgs).where(arrayOverlaps(orgs.innovationIds, ids)),
    db.select().from(calls).where(inArray(calls.status, ["open", "planned", "demo"])),
    db.select().from(people).where(inArray(people.role, ["mentor", "expert"])),
  ]);

  for (const card of cards) {
    const areas = new Set<MapaArea>(card.mapaAreas);
    const sites = siteRows
      .filter((s) => s.innovationId === card.id)
      .slice(0, 3)
      .map((s) => ({ place: s.place, stage: s.stage, isSample: s.isSample, sourceUrl: s.sourceUrl }));

    const helpers: PathHelper[] = orgRows
      .filter((o) => o.innovationIds.includes(card.id))
      .slice(0, 2)
      .map((o) => ({ name: o.name, kind: "org", detail: o.type, isSample: o.isSample, sourceUrl: o.sourceUrl }));
    const mentor = peopleRows.find((p) => p.areas.some((a) => areas.has(a)));
    if (mentor) {
      helpers.push({
        name: mentor.displayName,
        kind: "mentor",
        detail: mentor.title ?? mentor.orgName,
        isSample: mentor.isSample,
        sourceUrl: null,
      });
    }
    if (helpers.length === 0) {
      const authors = authorsLine(card);
      if (authors) helpers.push({ name: authors, kind: "author", detail: null, isSample: false, sourceUrl: card.sourceUrl });
    }

    const byArea = callRows
      .filter((c) => c.areas.some((a) => areas.has(a)))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const implementation = callRows
      .filter((c) => USLUGA_WRAZLIWA.test(`${c.program ?? ""} ${c.name}`))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const funding: PathFunding[] = [];
    for (const c of [...byArea, ...implementation]) {
      if (funding.length >= 2) break;
      if (funding.some((f) => f.id === c.id)) continue;
      funding.push({
        id: c.id,
        name: c.name,
        program: c.program,
        status: c.status,
        windowTo: c.windowTo,
        sourceUrl: c.sourceUrl,
      });
    }
    out.set(card.id, { sites, helpers, funding });
  }
  return out;
}

export type Similar = { days: number; count: number; powiatCount: number | null; powiatName: string | null };

/** Other runs in the same Mapa area in the last 30 days (and how many in the same powiat). */
export async function similarRuns(
  db: Db,
  opts: { runId: string; area: MapaArea | undefined; powiatTeryt: string | null },
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
    powiatName: powiatName(powiat),
  };
}
