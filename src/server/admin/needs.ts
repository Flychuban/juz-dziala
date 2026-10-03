/**
 * Pure aggregation of reported needs for /admin/trends: what counts as a
 * „biała plama", weekly buckets, per powiat / per area counts and the
 * area × powiat groups. No database — unit-tested in needs.test.ts.
 */
import { z } from "zod";

import { POWIAT_NAMES } from "~/components/map/powiaty";
import { MAPA_AREA_LABEL, MAPA_AREAS, type MapaArea } from "~/lib/domain";

export const TREND_DAYS = [7, 30, 90] as const;
export type TrendDays = (typeof TREND_DAYS)[number];

/** One reported need: a matching run, or a „need" case that did not come from a run. */
export type Need = {
  source: "run" | "case";
  at: Date;
  areas: MapaArea[];
  powiat: string | null;
  text: string;
  /** Unmet: the run abstained, or it was low-confidence with no verified AI match. */
  unmet: boolean;
  isSample: boolean;
};

const keywordShape = z
  .object({
    isLowConfidence: z.boolean().optional(),
    /** StoredKeyword v1 (src/server/match/core.ts). */
    hits: z.array(z.unknown()).optional(),
    /** Older shape (KeywordResult). */
    results: z.array(z.unknown()).optional(),
  })
  .loose();
const aiShape = z
  .object({
    matches: z.array(z.unknown()).optional(),
    abstained: z.boolean().optional(),
  })
  .loose();

/** A run is a „biała plama" when nothing confident answered it. */
export function isUnmet(run: {
  abstained: boolean;
  status: string;
  keywordResult: unknown;
  aiResult: unknown;
}): boolean {
  if (run.abstained || run.status === "abstained") return true;
  const kw = keywordShape.safeParse(run.keywordResult);
  const ai = aiShape.safeParse(run.aiResult);
  const aiMatches = ai.success ? (ai.data.matches?.length ?? 0) : 0;
  if (ai.success && ai.data.abstained === true && aiMatches === 0) return true;
  const hits = kw.success ? (kw.data.hits ?? kw.data.results ?? []) : [];
  const lowConfidence = kw.success
    ? (kw.data.isLowConfidence ?? false) || hits.length === 0
    : true;
  return lowConfidence && aiMatches === 0;
}

export const isArea = (a: string): a is MapaArea =>
  (MAPA_AREAS as readonly string[]).includes(a);

/** Monday (UTC) of the week a date falls in, as YYYY-MM-DD. */
export function weekStart(d: Date): string {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

export const powiatName = (teryt: string | null) =>
  teryt
    ? POWIAT_NAMES[teryt]
      ? `${teryt.startsWith("126") ? "" : "powiat "}${POWIAT_NAMES[teryt]}`
      : teryt
    : "nie podano";

export function summarize(needs: Need[]) {
  const byPowiat: Record<string, number> = {};
  const byArea = new Map<MapaArea | "none", { count: number; unmet: number }>();
  const byWeek = new Map<string, { count: number; unmet: number }>();
  const cells = new Map<
    string,
    { week: string; area: string; powiat: string; count: number; unmet: number }
  >();
  for (const n of needs) {
    if (n.powiat) byPowiat[n.powiat] = (byPowiat[n.powiat] ?? 0) + 1;
    const week = weekStart(n.at);
    const w = byWeek.get(week) ?? { count: 0, unmet: 0 };
    w.count++;
    if (n.unmet) w.unmet++;
    byWeek.set(week, w);
    const areas: (MapaArea | "none")[] = n.areas.length ? n.areas : ["none"];
    for (const a of areas) {
      const x = byArea.get(a) ?? { count: 0, unmet: 0 };
      x.count++;
      if (n.unmet) x.unmet++;
      byArea.set(a, x);
      const key = `${week}|${a}|${n.powiat ?? ""}`;
      const c = cells.get(key) ?? {
        week,
        area: a,
        powiat: n.powiat ?? "",
        count: 0,
        unmet: 0,
      };
      c.count++;
      if (n.unmet) c.unmet++;
      cells.set(key, c);
    }
  }
  return {
    total: needs.length,
    unmet: needs.filter((n) => n.unmet).length,
    sample: needs.filter((n) => n.isSample).length,
    withPowiat: needs.filter((n) => n.powiat).length,
    byPowiat,
    byArea: [...MAPA_AREAS, "none" as const]
      .map((a) => ({
        area: a,
        label: a === "none" ? "Bez przypisanego obszaru" : MAPA_AREA_LABEL[a],
        ...(byArea.get(a) ?? { count: 0, unmet: 0 }),
      }))
      .filter((a) => a.area !== "none" || a.count > 0)
      .sort((a, b) => b.count - a.count),
    byWeek: [...byWeek.entries()]
      .map(([week, v]) => ({ week, ...v }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    cells: [...cells.values()].sort(
      (a, b) =>
        a.week.localeCompare(b.week) ||
        a.area.localeCompare(b.area) ||
        a.powiat.localeCompare(b.powiat),
    ),
  };
}

export type WhiteSpot = {
  area: MapaArea | "none";
  areaLabel: string;
  powiat: string | null;
  powiatName: string;
  count: number;
  examples: string[];
  sample: boolean;
};

/** Unmet needs grouped by area × powiat, largest first, with up to 3 redacted phrasings. */
export function whiteSpots(needs: Need[]): WhiteSpot[] {
  const groups = new Map<string, Need[]>();
  for (const n of needs.filter((x) => x.unmet)) {
    for (const a of n.areas.length ? n.areas : (["none"] as const)) {
      const key = `${a}|${n.powiat ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const [area, powiat] = key.split("|") as [MapaArea | "none", string];
      const sorted = [...list].sort((a, b) => b.at.getTime() - a.at.getTime());
      return {
        area,
        areaLabel:
          area === "none" ? "Bez przypisanego obszaru" : MAPA_AREA_LABEL[area],
        powiat: powiat || null,
        powiatName: powiatName(powiat || null),
        count: list.length,
        examples: [...new Set(sorted.map((n) => n.text.trim()))]
          .slice(0, 3)
          .map((t) => (t.length > 220 ? `${t.slice(0, 219).trimEnd()}…` : t)),
        sample: list.every((n) => n.isSample),
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count || a.areaLabel.localeCompare(b.areaLabel, "pl"),
    );
}
