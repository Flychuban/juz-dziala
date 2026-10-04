import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { asc, inArray } from "drizzle-orm";

import type { Locale } from "~/i18n/config";
import type { Db } from "~/server/db";
import { calls, innovations } from "~/server/db/schema";
import type {
  FundingCall,
  FundingKind,
  Gmina,
  GusSource,
  RamowyPlan,
} from "./types";

/*
 * Data the Middleman and „Dla gminy" read: data/gminas.json + gus.meta.json
 * (GUS BDL, produced by scripts/fetch-gus.ts) and the ROPS calls (the DB is
 * the source of truth for status and amounts; data/calls.json adds the list
 * of innovations each Usługa Wrażliwa call was limited to, which the table
 * does not store).
 */

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", file), "utf8");
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[adapt] could not read data/${file}`, e);
    return null;
  }
}

let gminasCache: Gmina[] | null = null;
/** All 183 Małopolska gminas, sorted by name. Empty when the file is missing. */
export async function loadGminas(): Promise<Gmina[]> {
  if (gminasCache) return gminasCache;
  const rows = (await readJson<Gmina[]>("gminas.json")) ?? [];
  const sorted = [...rows].sort(
    (a, b) => a.name.localeCompare(b.name, "pl") || a.kind.localeCompare(b.kind),
  );
  if (sorted.length > 0) gminasCache = sorted;
  return sorted;
}

export async function getGmina(teryt: string): Promise<Gmina | null> {
  return (await loadGminas()).find((g) => g.teryt === teryt) ?? null;
}

type GusMeta = {
  source?: string;
  api?: string;
  capturedAt?: string;
  year?: number;
  baseYear?: number;
  variables?: Record<string, { id: number }>;
};

let gusCache: GusMeta | null = null;
async function loadGusMeta(): Promise<GusMeta> {
  gusCache ??= (await readJson<GusMeta>("gus.meta.json")) ?? {};
  return gusCache;
}

/** The BDL API query that returns exactly this gmina's figures. */
export function bdlUnitUrl(
  api: string,
  bdlId: string,
  year: number,
  baseYear: number,
  varIds: number[],
): string {
  const q = new URLSearchParams();
  for (const v of varIds) q.append("var-id", String(v));
  q.append("year", String(baseYear));
  q.append("year", String(year));
  q.set("format", "json");
  return `${api}/data/by-unit/${bdlId}?${q.toString()}`;
}

export async function gusSourceFor(g: Gmina): Promise<GusSource> {
  const meta = await loadGusMeta();
  const api = meta.api ?? "https://bdl.stat.gov.pl/api/v1";
  const year = meta.year ?? g.year;
  const baseYear = meta.baseYear ?? year - 10;
  const varIds = Object.values(meta.variables ?? {})
    .map((v) => v.id)
    .filter((n) => Number.isFinite(n));
  return {
    name: meta.source ?? "GUS, Bank Danych Lokalnych",
    url: bdlUnitUrl(
      api,
      g.bdlId,
      year,
      baseYear,
      varIds.length ? varIds : [72305, 72239, 72240, 76024, 76025],
    ),
    capturedAt: meta.capturedAt ?? `${year}-12-31`,
    year,
    baseYear,
  };
}

/** Source line for pages that show figures for many gminas at once. */
export async function gusSourceGeneral(): Promise<{
  name: string;
  url: string;
  capturedAt: string | null;
  year: number | null;
}> {
  const meta = await loadGusMeta();
  return {
    name: meta.source ?? "GUS, Bank Danych Lokalnych",
    url: "https://bdl.stat.gov.pl/bdl/start",
    capturedAt: meta.capturedAt ?? null,
    year: meta.year ?? null,
  };
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

type CallJson = {
  id: string;
  innovations?: { cardId?: string | null; title?: string | null }[];
};

let callInnovationsCache: Map<string, { cardId: string | null; title: string }[]> | null =
  null;
async function callInnovations() {
  if (callInnovationsCache) return callInnovationsCache;
  const rows = (await readJson<CallJson[]>("calls.json")) ?? [];
  const m = new Map<string, { cardId: string | null; title: string }[]>();
  for (const c of rows) {
    m.set(
      c.id,
      (c.innovations ?? [])
        .filter((i) => i.title)
        .map((i) => ({ cardId: i.cardId ?? null, title: i.title! })),
    );
  }
  callInnovationsCache = m;
  return m;
}

type CallEnJson = {
  id: string;
  program?: string | null;
  operator?: string | null;
  notes?: string | null;
};

let callsEnCache: Map<string, CallEnJson> | null = null;
/** data/calls.en.json — the announcements' own words in English, by call id. */
async function callsEn(): Promise<Map<string, CallEnJson>> {
  if (callsEnCache) return callsEnCache;
  const rows = (await readJson<CallEnJson[]>("calls.en.json")) ?? [];
  const m = new Map(rows.map((c) => [c.id, c]));
  if (m.size > 0) callsEnCache = m;
  return m;
}

/** Which family a call belongs to, by its published name/programme. */
export function fundingKind(c: {
  id: string;
  name: string;
  program: string | null;
}): FundingKind | null {
  const text = `${c.id} ${c.name} ${c.program ?? ""}`;
  if (/usług[aię] wrażliw|usluga-wrazliwa/i.test(text)) return "usluga-wrazliwa";
  if (/inkubator włączenia społecznego|^iws/i.test(text)) return "iws";
  return null;
}

function sentences(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The calls that can pay for an implementation (Usługa Wrażliwa) or for
 * developing an innovation (IWS), newest first. Demo calls are left out:
 * a plan for a real institution never points at a call ROPS did not announce.
 * For an English plan each call also carries its announcement's own English
 * words (`calls.en`, else data/calls.en.json) and the English titles of the
 * innovations it was limited to.
 */
export async function fundingFor(
  db: Db,
  innovationId: string,
  locale: Locale = "pl",
): Promise<{ funding: FundingCall[]; ramowyPlan: RamowyPlan | null }> {
  const rows = await db
    .select()
    .from(calls)
    .where(inArray(calls.status, ["open", "planned", "closed"]))
    .orderBy(asc(calls.windowFrom));
  const lists = await callInnovations();
  const enFile = locale === "en" ? await callsEn() : new Map<string, CallEnJson>();
  const listedIds = [
    ...new Set(
      rows.flatMap((c) => (lists.get(c.id) ?? []).map((i) => i.cardId)),
    ),
  ].filter((id): id is string => !!id);
  const enTitles = new Map<string, string>();
  if (locale === "en" && listedIds.length > 0) {
    const cards = await db
      .select({ id: innovations.id, en: innovations.en })
      .from(innovations)
      .where(inArray(innovations.id, listedIds));
    for (const c of cards) if (c.en?.title) enTitles.set(c.id, c.en.title);
  }
  const funding: FundingCall[] = [];
  for (const c of rows) {
    const kind = fundingKind(c);
    if (!kind) continue;
    const list = lists.get(c.id) ?? [];
    const notes = sentences(c.notes);
    let en: FundingCall["en"] = null;
    if (locale === "en") {
      const src = c.en ?? enFile.get(c.id) ?? null;
      if (src) {
        const enNotes = sentences(src.notes);
        en = {
          program: src.program ?? null,
          operator: src.operator ?? null,
          purpose: enNotes[0] ?? null,
          ownContribution:
            enNotes.find((x) => /own contribution/i.test(x)) ?? null,
          innovationTitles: list.map((i) =>
            i.cardId ? (enTitles.get(i.cardId) ?? i.title) : i.title,
          ),
        };
      }
    }
    funding.push({
      id: c.id,
      kind,
      name: c.name,
      program: c.program,
      operator: c.operator,
      amountMax: c.amountMax,
      windowFrom: c.windowFrom,
      windowTo: c.windowTo,
      status: c.status,
      sourceUrl: c.sourceUrl,
      purpose: notes[0] ?? null,
      ownContribution: notes.find((s) => /^Wkład własny/i.test(s)) ?? null,
      innovationTitles: list.map((i) => i.title),
      includesInnovation: list.some((i) => i.cardId === innovationId),
      en,
    });
  }
  // Usługa Wrażliwa first (it funds implementation), newest first within kind.
  funding.sort(
    (a, b) =>
      Number(b.kind === "usluga-wrazliwa") - Number(a.kind === "usluga-wrazliwa") ||
      (b.windowFrom ?? "").localeCompare(a.windowFrom ?? ""),
  );
  const rp = funding.find(
    (f) => f.kind === "usluga-wrazliwa" && f.includesInnovation,
  );
  return {
    funding,
    ramowyPlan: rp
      ? { callId: rp.id, callName: rp.name, sourceUrl: rp.sourceUrl }
      : null,
  };
}

/**
 * Card id → the Usługa Wrażliwa call whose list includes it (a ROPS Ramowy
 * Plan Wdrożenia exists). Used for the badge on lists.
 */
export async function ramowyPlanIndex(
  db: Db,
): Promise<Map<string, RamowyPlan>> {
  const lists = await callInnovations();
  const ids = [...lists.keys()];
  const out = new Map<string, RamowyPlan>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      id: calls.id,
      name: calls.name,
      program: calls.program,
      sourceUrl: calls.sourceUrl,
    })
    .from(calls)
    .where(inArray(calls.id, ids));
  for (const c of rows) {
    if (fundingKind(c) !== "usluga-wrazliwa") continue;
    for (const i of lists.get(c.id) ?? []) {
      if (i.cardId && !out.has(i.cardId)) {
        out.set(i.cardId, {
          callId: c.id,
          callName: c.name,
          sourceUrl: c.sourceUrl,
        });
      }
    }
  }
  return out;
}

