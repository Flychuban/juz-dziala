/**
 * „Twoja ścieżka" for one card — Działa już w → Kto pomoże → Skąd pieniądze —
 * chosen from rows the database holds. Pure, so it is unit-tested; the DB
 * reads live in joins.ts. An empty step stays empty; nothing is filled in.
 */
import type { CallStatus } from "~/lib/domain";
import type { LibraryCard, MapaArea } from "~/server/domain/types";

export type SiteRow = { innovationId: string; place: string; stage: string; isSample: boolean; sourceUrl: string | null };
export type OrgRow = { name: string; type: string; innovationIds: string[]; isSample: boolean; sourceUrl: string | null };
export type PersonRow = {
  id: string;
  displayName: string;
  role: string;
  title: string | null;
  orgName: string | null;
  areas: MapaArea[];
  isSample: boolean;
};
export type CallRow = {
  id: string;
  name: string;
  program: string | null;
  status: CallStatus;
  windowFrom: string | null;
  windowTo: string | null;
  sourceUrl: string | null;
};

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
  windowFrom: string | null;
  windowTo: string | null;
  sourceUrl: string | null;
  /** "listed": the call document names this very card; "general": a call for social innovations in general. */
  reason: "listed" | "general";
};
export type Path = { sites: PathSite[]; helpers: PathHelper[]; funding: PathFunding | null };

const isUslugaWrazliwa = (id: string) => id.startsWith("usluga-wrazliwa");
/** Calls for (new) social innovations: IWS and its demo. mentorES is business mentoring, not funding for a card. */
const isIws = (id: string) => id.startsWith("iws") || id.startsWith("demo-iws");
const STATUS_ORDER: Record<CallStatus, number> = { open: 0, planned: 1, demo: 2, closed: 3 };

function authorsLine(card: LibraryCard): string | null {
  const a = card.sections.authors.replace(/\s+/gu, " ").trim();
  if (!a) return null;
  return a.length > 160 ? `${a.slice(0, 159)}…` : a;
}

/**
 * Usługa Wrażliwa when its call lists this card (even a closed one: the page
 * then says the call has ended and to ask ROPS about the next). Otherwise only
 * an open or demo call for social innovations; never another closed call.
 */
export function pickFunding(
  card: LibraryCard,
  callRows: readonly CallRow[],
  listedIn: ReadonlyMap<string, ReadonlySet<string>>,
): PathFunding | null {
  const byStatusThenNewest = (a: CallRow, b: CallRow) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.windowTo ?? "").localeCompare(a.windowTo ?? "");
  const listed = callRows
    .filter((c) => isUslugaWrazliwa(c.id) && listedIn.get(c.id)?.has(card.id))
    .sort(byStatusThenNewest);
  const general = callRows
    .filter((c) => isIws(c.id) && (c.status === "open" || c.status === "demo"))
    .sort(byStatusThenNewest);
  const pick = listed[0] ?? general[0];
  if (!pick) return null;
  return {
    id: pick.id,
    name: pick.name,
    program: pick.program,
    status: pick.status,
    windowFrom: pick.windowFrom,
    windowTo: pick.windowTo,
    sourceUrl: pick.sourceUrl,
    reason: listed[0] ? "listed" : "general",
  };
}

/**
 * The organisation behind the card; else a mentor or expert whose areas
 * include the card's FIRST Mapa area (a seniors card gets a seniors mentor);
 * else the card's own authors line.
 */
export function pickHelpers(card: LibraryCard, orgRows: readonly OrgRow[], peopleRows: readonly PersonRow[]): PathHelper[] {
  const orgsForCard = orgRows
    .filter((o) => o.innovationIds.includes(card.id))
    .slice(0, 2)
    .map((o) => ({ name: o.name, kind: "org" as const, detail: o.type, isSample: o.isSample, sourceUrl: o.sourceUrl }));
  if (orgsForCard.length > 0) return orgsForCard;
  const firstArea: MapaArea | undefined = card.mapaAreas[0];
  const mentor = firstArea
    ? peopleRows.find((p) => (p.role === "mentor" || p.role === "expert") && p.areas.includes(firstArea))
    : undefined;
  if (mentor) {
    return [
      {
        name: mentor.displayName,
        kind: "mentor",
        detail: mentor.title ?? mentor.orgName,
        isSample: mentor.isSample,
        sourceUrl: null,
      },
    ];
  }
  const authors = authorsLine(card);
  return authors ? [{ name: authors, kind: "author", detail: null, isSample: false, sourceUrl: card.sourceUrl }] : [];
}

export function buildPath(
  card: LibraryCard,
  rows: {
    sites: readonly SiteRow[];
    orgs: readonly OrgRow[];
    people: readonly PersonRow[];
    calls: readonly CallRow[];
    listedIn: ReadonlyMap<string, ReadonlySet<string>>;
  },
): Path {
  return {
    sites: rows.sites
      .filter((s) => s.innovationId === card.id)
      .slice(0, 3)
      .map((s) => ({ place: s.place, stage: s.stage, isSample: s.isSample, sourceUrl: s.sourceUrl })),
    helpers: pickHelpers(card, rows.orgs, rows.people),
    funding: pickFunding(card, rows.calls, rows.listedIn),
  };
}
