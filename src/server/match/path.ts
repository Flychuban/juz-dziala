/**
 * „Twoja ścieżka" for one card — Kto to prowadzi → Kto pomoże → Skąd pieniądze —
 * chosen from rows the database holds. Pure, so it is unit-tested; the DB
 * reads live in joins.ts. Nothing is filled in: an unknown organisation hides
 * its step, a missing mentor becomes the ROPS Hub team, and the general grant
 * call is shown once under all results rather than on every card.
 */
import type { CallStatus } from "~/lib/domain";
import type { LibraryCard, MapaArea } from "~/server/domain/types";

export type SiteRow = { innovationId: string; place: string; stage: string; isSample: boolean; sourceUrl: string | null };
export type OrgRow = {
  name: string;
  type: string;
  innovationIds: string[];
  isSample: boolean;
  sourceUrl: string | null;
  /** The gmina of the organisation, resolved to a name, when known. */
  place?: string | null;
};
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
  /** English name of the call (calls.en.name), when translated. */
  nameEn?: string | null;
};

/** The organisation behind the card: from the network (jd_org) or, failing that, the card's own „Autorzy". */
export type PathRunBy = {
  name: string;
  /** Raw org type ("fundacja", "ops", …) — the page turns it into words; null for the card's authors line. */
  type: string | null;
  /** Where it runs, when the data says so; never guessed. */
  place: string | null;
  isSample: boolean;
  sourceUrl: string | null;
  /** True when the name is the card's own authors line (no organisation record). */
  fromCard: boolean;
};
export type PathMentor = {
  name: string;
  role: "mentor" | "expert";
  /** The person's own title (Polish), e.g. „Mentorka — seniorzy i opieka wytchnieniowa". */
  title: string | null;
  areas: MapaArea[];
  isSample: boolean;
};
export type PathFunding = {
  id: string;
  name: string;
  nameEn: string | null;
  program: string | null;
  status: CallStatus;
  windowFrom: string | null;
  windowTo: string | null;
  sourceUrl: string | null;
  /** "listed": the call document names this very card; "general": a call for social innovations in general. */
  reason: "listed" | "general";
};
export type Path = {
  runBy: PathRunBy[];
  /** A mentor whose areas include the card's area; null → the ROPS Hub team. */
  mentor: PathMentor | null;
  /** Only a call that lists this very card; the general call is shown once below the results. */
  funding: PathFunding | null;
};

const isUslugaWrazliwa = (id: string) => id.startsWith("usluga-wrazliwa");
/** Calls for (new) social innovations: IWS and its demo. mentorES is business mentoring, not funding for a card. */
const isIws = (id: string) => id.startsWith("iws") || id.startsWith("demo-iws");
const STATUS_ORDER: Record<CallStatus, number> = { open: 0, planned: 1, demo: 2, closed: 3 };
const byStatusThenNewest = (a: CallRow, b: CallRow) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.windowTo ?? "").localeCompare(a.windowTo ?? "");

function toFunding(c: CallRow, reason: PathFunding["reason"]): PathFunding {
  return {
    id: c.id,
    name: c.name,
    nameEn: c.nameEn ?? null,
    program: c.program,
    status: c.status,
    windowFrom: c.windowFrom,
    windowTo: c.windowTo,
    sourceUrl: c.sourceUrl,
    reason,
  };
}

/** Usługa Wrażliwa when its call lists this card — even a closed one (the page then points to the next call). */
export function pickListedFunding(
  card: LibraryCard,
  callRows: readonly CallRow[],
  listedIn: ReadonlyMap<string, ReadonlySet<string>>,
): PathFunding | null {
  const listed = callRows
    .filter((c) => isUslugaWrazliwa(c.id) && listedIn.get(c.id)?.has(card.id))
    .sort(byStatusThenNewest)[0];
  return listed ? toFunding(listed, "listed") : null;
}

/** An open (or demo) call for social innovations in general; never a closed one, never mentorES. */
export function pickGeneralFunding(callRows: readonly CallRow[]): PathFunding | null {
  const general = callRows
    .filter((c) => isIws(c.id) && (c.status === "open" || c.status === "demo"))
    .sort(byStatusThenNewest)[0];
  return general ? toFunding(general, "general") : null;
}

/** The listed call for this card, else the general one. */
export function pickFunding(
  card: LibraryCard,
  callRows: readonly CallRow[],
  listedIn: ReadonlyMap<string, ReadonlySet<string>>,
): PathFunding | null {
  return pickListedFunding(card, callRows, listedIn) ?? pickGeneralFunding(callRows);
}

/** The first line of the card's „Autorzy", without the „(oraz osoby prywatne…)" note. */
export function authorsName(card: LibraryCard): string | null {
  const first = card.sections.authors
    .split(/\n/u)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("("));
  if (!first) return null;
  const a = first.replace(/\s+/gu, " ");
  return a.length > 160 ? `${a.slice(0, 159)}…` : a;
}

/**
 * Who runs the card: the organisation(s) the network links to it, with the
 * place from its sites or its gmina when known; else the card's authors line.
 * Empty when neither exists — the step is then hidden.
 */
export function pickRunBy(card: LibraryCard, orgRows: readonly OrgRow[], siteRows: readonly SiteRow[] = []): PathRunBy[] {
  const sitePlace = siteRows.find((s) => s.innovationId === card.id)?.place ?? null;
  const orgsForCard = orgRows
    .filter((o) => o.innovationIds.includes(card.id))
    .slice(0, 2)
    .map((o) => ({
      name: o.name,
      type: o.type,
      place: o.place ?? sitePlace,
      isSample: o.isSample,
      sourceUrl: o.sourceUrl,
      fromCard: false,
    }));
  if (orgsForCard.length > 0) return orgsForCard;
  const authors = authorsName(card);
  return authors
    ? [{ name: authors, type: null, place: sitePlace, isSample: false, sourceUrl: card.sourceUrl, fromCard: true }]
    : [];
}

/**
 * A mentor or expert whose areas include the card's FIRST Mapa area (a seniors
 * card gets a seniors mentor). Never one who only shares a later area; never a
 * guess — null means „Zespół Hubu ROPS".
 */
export function pickMentor(card: LibraryCard, peopleRows: readonly PersonRow[]): PathMentor | null {
  const area: MapaArea | undefined = card.mapaAreas[0];
  if (!area) return null;
  const p = peopleRows.find((x) => (x.role === "mentor" || x.role === "expert") && x.areas.includes(area));
  if (!p) return null;
  return {
    name: p.displayName,
    role: p.role === "expert" ? "expert" : "mentor",
    title: p.title,
    areas: p.areas,
    isSample: p.isSample,
  };
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
    runBy: pickRunBy(card, rows.orgs, rows.sites),
    mentor: pickMentor(card, rows.people),
    funding: pickListedFunding(card, rows.calls, rows.listedIn),
  };
}
