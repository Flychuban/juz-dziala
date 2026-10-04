/**
 * „Małopolska w liczbach" — regional figures computed from data/gminas.json
 * (GUS Bank Danych Lokalnych, per gmina) and data/gus.meta.json (what was
 * fetched, for which year, when). Pure and unit-tested; the loader below
 * reads the files once per process. Nothing here is estimated: a figure the
 * data cannot support is null and the page does not show it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type GminaStats = {
  teryt: string;
  name: string;
  kind: string | null;
  powiatTeryt: string;
  powiatName: string | null;
  population: number;
  pop65: number;
  pop80: number;
  /** % change of population over 10 years, rounded to 0.1; null when not comparable. */
  popChange10y: number | null;
};

export type RankedGmina = {
  name: string;
  kind: string | null;
  powiatName: string | null;
  /** Percent, one decimal, as stated in (or computed from) the data. */
  value: number;
};

export type RegionFigures = {
  /** Year the figures describe (state on 31 December). */
  year: number | null;
  /** First year of the 10-year comparison. */
  baseYear: number | null;
  /** When the data was fetched from GUS (ISO). */
  capturedAt: string | null;
  /** GUS subject id, e.g. "P2137". */
  subjectId: string | null;
  gminaCount: number;
  population: number;
  pop65: number;
  pop80: number;
  /** Shares in percent, one decimal. */
  share65: number;
  share80: number;
  /** Gminas where at least a quarter of residents are 65 or older. */
  gminas65Quarter: number;
  /** Highest 65+ shares. */
  oldest: RankedGmina[];
  /**
   * Population change over the whole region, from gminas whose borders did
   * not change. `approx` when the per-gmina rounding leaves the first decimal
   * uncertain — the page then says „about".
   */
  change: {
    pct: number;
    approx: boolean;
    gminas: number;
    excluded: string[];
  } | null;
  depopulating: { count: number; of: number };
  fastestGrowing: RankedGmina[];
  /** True when every one of `fastestGrowing` lies in a powiat bordering Kraków. */
  fastestAroundKrakow: boolean;
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Powiats that share a border with the city of Kraków: krakowski, wielicki. */
export const KRAKOW_NEIGHBOUR_POWIATS = ["1206", "1219"] as const;

/** Tolerant reader of data/gminas.json; rows without the needed numbers are skipped. */
export function parseGminaStats(json: unknown): GminaStats[] {
  const list = Array.isArray(json)
    ? json
    : isRec(json) && Array.isArray(json.gminas)
      ? json.gminas
      : [];
  const out: GminaStats[] = [];
  const seen = new Set<string>();
  for (const g of list) {
    if (!isRec(g)) continue;
    const teryt = (text(g.teryt) ?? "").replace(/\D/g, "");
    const name = text(g.name);
    const population = num(g.population);
    const pop65 = num(g.pop65);
    const pop80 = num(g.pop80);
    if (!name || teryt.length < 6 || seen.has(teryt)) continue;
    if (
      population === null ||
      population <= 0 ||
      pop65 === null ||
      pop80 === null
    )
      continue;
    seen.add(teryt);
    out.push({
      teryt,
      name,
      kind: text(g.kind),
      powiatTeryt: (text(g.powiatTeryt) ?? teryt.slice(0, 4)).replace(
        /\D/g,
        "",
      ),
      powiatName: text(g.powiatName),
      population,
      pop65,
      pop80,
      popChange10y: num(g.popChange10y),
    });
  }
  return out;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function ranked(
  rows: GminaStats[],
  value: (g: GminaStats) => number,
  n: number,
): RankedGmina[] {
  return [...rows]
    .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name, "pl"))
    .slice(0, n)
    .map((g) => ({
      name: g.name,
      kind: g.kind,
      powiatName: g.powiatName,
      value: round1(value(g)),
    }));
}

/**
 * Regional change from per-gmina changes: the base-year population of each
 * gmina is population / (1 + change). The changes are rounded to 0.1, so the
 * result is also computed at both ends of that rounding; when the ends do not
 * round to the same first decimal, the figure is marked `approx`.
 */
export function regionalChange(
  rows: GminaStats[],
): { pct: number; approx: boolean; gminas: number } | null {
  const comparable = rows.filter((g) => g.popChange10y !== null);
  if (comparable.length === 0) return null;
  const now = comparable.reduce((s, g) => s + g.population, 0);
  const base = (d: number) =>
    comparable.reduce(
      (s, g) => s + g.population / (1 + (g.popChange10y! + d) / 100),
      0,
    );
  const pct = (b: number) => (now / b - 1) * 100;
  const mid = round1(pct(base(0)));
  const approx =
    round1(pct(base(0.0499))) !== mid || round1(pct(base(-0.0499))) !== mid;
  return { pct: mid, approx, gminas: comparable.length };
}

export function computeRegionFigures(
  gminasJson: unknown,
  metaJson: unknown,
): RegionFigures | null {
  const rows = parseGminaStats(gminasJson);
  if (rows.length === 0) return null;
  const meta = isRec(metaJson) ? metaJson : {};
  const subject = isRec(meta.subject) ? meta.subject : {};

  const population = rows.reduce((s, g) => s + g.population, 0);
  const pop65 = rows.reduce((s, g) => s + g.pop65, 0);
  const pop80 = rows.reduce((s, g) => s + g.pop80, 0);
  const comparable = rows.filter((g) => g.popChange10y !== null);
  const change = regionalChange(rows);
  const growing = ranked(comparable, (g) => g.popChange10y!, 5);
  const growingRows = [...comparable]
    .sort(
      (a, b) =>
        b.popChange10y! - a.popChange10y! || a.name.localeCompare(b.name, "pl"),
    )
    .slice(0, 5);

  return {
    year: num(meta.year),
    baseYear: num(meta.baseYear),
    capturedAt: text(meta.capturedAt),
    subjectId: text(subject.id),
    gminaCount: rows.length,
    population,
    pop65,
    pop80,
    share65: round1((pop65 / population) * 100),
    share80: round1((pop80 / population) * 100),
    gminas65Quarter: rows.filter((g) => g.pop65 / g.population >= 0.25).length,
    oldest: ranked(rows, (g) => (g.pop65 / g.population) * 100, 5),
    change: change
      ? {
          ...change,
          excluded: rows
            .filter((g) => g.popChange10y === null)
            .map((g) => g.name),
        }
      : null,
    depopulating: {
      count: comparable.filter((g) => g.popChange10y! < 0).length,
      of: comparable.length,
    },
    fastestGrowing: growing,
    fastestAroundKrakow:
      growingRows.length > 0 &&
      growingRows.every((g) =>
        (KRAKOW_NEIGHBOUR_POWIATS as readonly string[]).includes(g.powiatTeryt),
      ),
  };
}

function readData(file: string): unknown {
  const path = join(process.cwd(), "data", file);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (e) {
    console.error(`[knowledge] could not read data/${file}`, e);
    return null;
  }
}

let cache: { value: RegionFigures | null } | null = null;

/** Regional figures for the knowledge pages; null when data/gminas.json is missing. */
export function regionFigures(): RegionFigures | null {
  cache ??= {
    value: computeRegionFigures(
      readData("gminas.json"),
      readData("gus.meta.json"),
    ),
  };
  return cache.value;
}
