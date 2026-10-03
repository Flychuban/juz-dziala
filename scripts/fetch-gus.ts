/**
 * GUS Bank Danych Lokalnych → data/gminas.json + data/gus.meta.json
 *
 *   pnpm exec tsx scripts/fetch-gus.ts
 *
 * Anonymous BDL API (no X-ClientId), ≥1.6 s between calls, each response archived. On HTTP 429 the
 * client backs off a few times and then gives up; values it could not get stay null.
 *
 * Units: level 6 under MAŁOPOLSKIE (011200000000). A gmina's BDL id ends in its kind: 1 miejska,
 * 2 wiejska, 3 miejsko-wiejska; 4/5 (town / rural part of a miejsko-wiejska gmina) are not
 * gminas and are skipped. The unit list is not year-specific, so a gmina whose kind changed
 * (e.g. wiejska → miejsko-wiejska after town rights) appears under two ids; a gmina is CURRENT
 * when it has a population value in the latest year, and its value ten years earlier is taken
 * from the same id or, failing that, from the predecessor with the same powiat+gmina number and
 * the same name (each such pairing is listed in gus.meta.json).
 *
 * TERYT (7 digits, WWPPGGR) is derived from the BDL id: id[2..4] + id[7..9] + id[9..11] + id[11]
 * (e.g. 011212161011 → 1261011, Kraków) and checked against the PRG gmina layer of the same
 * GeoJSON repository used for the powiat map (name must match).
 */
import { pathToFileURL } from "node:url";
import { politeFetch, writeJson } from "./lib/http";
import { bdlAll, bdlGet } from "./lib/bdl";
import { Gminas, type Gmina } from "./schemas";

const MALOPOLSKA = "011200000000";
const PRG_GMINY = "https://raw.githubusercontent.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy/main/gminy.json";

const VARS = {
  total: 72305,
  age65_69: 72239,
  age70plus: 72240,
  age80_84: 76024,
  age85plus: 76025,
} as const;
/** What each variable must be, per /variables/{id} (n1 = age group, n2 = sex). Checked at run time. */
const EXPECTED: Record<keyof typeof VARS, { n1: string; n2: string }> = {
  total: { n1: "ogółem", n2: "ogółem" },
  age65_69: { n1: "65-69", n2: "ogółem" },
  age70plus: { n1: "70 i więcej", n2: "ogółem" },
  age80_84: { n1: "80-84", n2: "ogółem" },
  age85plus: { n1: "85 i więcej", n2: "ogółem" },
};

type Unit = { id: string; name: string; parentId: string; level: number; kind: string; hasDescription?: boolean; description?: string };
type VarMeta = { id: number; subjectId: string; n1: string; n2: string; measureUnitName: string; years: number[] };
type DataRow = { id: string; name: string; values: { year: string; val: number | null; attrId: number }[] };

export function terytFromBdlId(id: string): string {
  if (!/^\d{12}$/.test(id)) throw new Error(`bad BDL id ${id}`);
  return id.slice(2, 4) + id.slice(7, 9) + id.slice(9, 11) + id.slice(11);
}
const KIND: Record<string, Gmina["kind"]> = { "1": "miejska", "2": "wiejska", "3": "miejsko-wiejska" };

async function main() {
  const notes: string[] = [];

  // ---- variables: verify meaning before use
  const varMeta: Record<string, VarMeta & { capturedAt: string }> = {};
  for (const [key, id] of Object.entries(VARS) as [keyof typeof VARS, number][]) {
    const r = await bdlGet<VarMeta>(`/variables/${id}`);
    const exp = EXPECTED[key];
    if (r.json.n1 !== exp.n1 || r.json.n2 !== exp.n2 || r.json.subjectId !== "P2137") {
      throw new Error(`variable ${id} is „${r.json.n1} / ${r.json.n2}" (${r.json.subjectId}), expected „${exp.n1} / ${exp.n2}" (P2137)`);
    }
    varMeta[key] = { ...r.json, capturedAt: r.capturedAt };
  }
  const subject = await bdlGet<{ id: string; name: string; description?: string; lastUpdate?: string }>(`/subjects/P2137`);

  // ---- units
  const units = await bdlAll<Unit>(`/units`, { "parent-id": MALOPOLSKA, level: 6 });
  const powiaty = await bdlAll<Unit>(`/units`, { "parent-id": MALOPOLSKA, level: 5 });
  const gminaUnits = units.results.filter((u) => ["1", "2", "3"].includes(u.id.slice(-1)));
  const powiatById = new Map(powiaty.results.map((p) => [p.id, p]));

  // ---- latest year with population data
  const candidateYears = [...varMeta.total!.years].sort((a, b) => b - a);
  let year: number | null = null;
  let totalRows: DataRow[] = [];
  for (const y of candidateYears.slice(0, 3)) {
    const r = await bdlAll<DataRow>(`/data/by-variable/${VARS.total}`, { "unit-parent-id": MALOPOLSKA, "unit-level": 6, year: [y, y - 10] });
    const withValue = r.results.filter((row) => row.values.some((v) => v.year === String(y) && v.val !== null));
    if (withValue.length > 0) {
      year = y;
      totalRows = r.results;
      break;
    }
    notes.push(`Rok ${y}: brak danych o ludności w BDL — sprawdzono wcześniejszy rok.`);
  }
  if (year === null) throw new Error("no recent population year found in BDL");
  const base = year - 10;

  const fetchVar = async (id: number) =>
    (await bdlAll<DataRow>(`/data/by-variable/${id}`, { "unit-parent-id": MALOPOLSKA, "unit-level": 6, year: [year] })).results;
  const rows: Record<string, DataRow[]> = { total: totalRows };
  for (const key of ["age65_69", "age70plus", "age80_84", "age85plus"] as const) {
    try {
      rows[key] = await fetchVar(VARS[key]);
    } catch (e) {
      notes.push(`Zmienna ${VARS[key]} (${key}) niepobrana: ${(e as Error).message}. Wartości = null.`);
      rows[key] = [];
    }
  }
  const valueOf = (key: string, id: string, y: number): number | null => {
    const v = rows[key]?.find((r) => r.id === id)?.values.find((x) => x.year === String(y));
    return v && typeof v.val === "number" ? v.val : null;
  };

  // ---- PRG names for TERYT verification
  const prg = JSON.parse((await politeFetch(PRG_GMINY)).body.toString("utf8")) as { features: { properties: Record<string, unknown> }[] };
  const prgByTeryt = new Map<string, string>();
  for (const f of prg.features) {
    const code = String(f.properties.JPT_KOD_JE ?? "");
    if (code.startsWith("12")) prgByTeryt.set(code, String(f.properties.JPT_NAZWA_ ?? ""));
  }

  // ---- assemble
  const current = gminaUnits.filter((u) => valueOf("total", u.id, year) !== null);
  const historical = gminaUnits.filter((u) => valueOf("total", u.id, year) === null);
  const pairings: { teryt: string; name: string; currentBdlId: string; predecessorBdlId: string }[] = [];
  const prgMismatches: string[] = [];

  // ---- BDL unit notes (boundary changes, kind changes, creations). A ten-year change is not
  // comparable when the gmina's TERRITORY changed after the base year: such gminas get
  // popChange10y = null. A note that describes a territorial change but carries no date
  // („wyodrębnienie gminy Szczawa") is treated as possibly recent — null, never guessed.
  const TERRITORIAL = /wyodręb|utworz|granic|włącz|wyłącz|przyłącz|podzia|połącz|zniesien/i;
  const unitNotes: { teryt: string; bdlId: string; name: string; description: string; affectsChange: boolean }[] = [];
  const noComparison = new Map<string, string>();
  for (const u of current.filter((c) => c.hasDescription)) {
    try {
      const d = (await bdlGet<Unit>(`/units/${u.id}`)).json.description ?? "";
      const years = [...d.matchAll(/\d{2}\.\d{2}\.(\d{4})/g)].map((m) => Number(m[1]));
      const affects = TERRITORIAL.test(d) && (years.length === 0 || years.some((y) => y > base));
      unitNotes.push({ teryt: terytFromBdlId(u.id), bdlId: u.id, name: u.name, description: d, affectsChange: affects });
      if (affects) noComparison.set(u.id, d);
    } catch (e) {
      notes.push(`Opis jednostki ${u.id} (${u.name}) niepobrany: ${(e as Error).message}`);
    }
  }

  const out: Gmina[] = current.map((u) => {
    const teryt = terytFromBdlId(u.id);
    const powiatBdl = u.id.slice(0, 9) + "000";
    const powiat = powiatById.get(powiatBdl);
    const prgName = prgByTeryt.get(teryt);
    if (prgName === undefined) prgMismatches.push(`${teryt} ${u.name}: brak w PRG`);
    else if (prgName.replace(/^gmina\s+/i, "").trim() !== u.name.trim()) prgMismatches.push(`${teryt}: BDL „${u.name}" ≠ PRG „${prgName}"`);

    const population = valueOf("total", u.id, year);
    let popBase = valueOf("total", u.id, base);
    if (popBase === null) {
      const pred = historical.find((h) => h.id.slice(0, 11) === u.id.slice(0, 11) && h.name === u.name && valueOf("total", h.id, base) !== null);
      if (pred) {
        popBase = valueOf("total", pred.id, base);
        pairings.push({ teryt, name: u.name, currentBdlId: u.id, predecessorBdlId: pred.id });
      }
    }
    const sum = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
    return {
      teryt,
      bdlId: u.id,
      name: u.name,
      kind: KIND[u.id.slice(-1)]!,
      powiatTeryt: teryt.slice(0, 4),
      powiatName: powiat ? powiat.name.replace(/^Powiat\s+/, "powiat ").replace(/^powiat m\.\s+/, "") : "",
      population,
      pop65: sum(valueOf("age65_69", u.id, year), valueOf("age70plus", u.id, year)),
      pop80: sum(valueOf("age80_84", u.id, year), valueOf("age85plus", u.id, year)),
      popChange10y:
        population !== null && popBase && !noComparison.has(u.id) ? Math.round(((population - popBase) / popBase) * 1000) / 10 : null,
      year,
    };
  });
  out.sort((a, b) => a.teryt.localeCompare(b.teryt));

  if (out.length !== 182) {
    const created = unitNotes.filter((n) => /utworzenie gminy/i.test(n.description) && [...n.description.matchAll(/\d{2}\.\d{2}\.(\d{4})/g)].some((m) => Number(m[1]) > base));
    notes.push(
      `${out.length} gmin zamiast często podawanych 182` +
        (created.length ? ` — w BDL i w PRG istnieje nowo utworzona gmina: ${created.map((c) => `${c.name} (${c.teryt}): ${c.description}`).join("; ")}` : "") +
        ".",
    );
  }
  if (out.some((g) => !g.powiatName)) throw new Error("gmina without a powiat");
  const gminas = Gminas.parse(out);
  writeJson("data/gminas.json", gminas);

  const capturedAt = subject.capturedAt; // time of the BDL responses used, not of this run (replays reproduce it)
  writeJson("data/gus.meta.json", {
    source: "GUS, Bank Danych Lokalnych (API v1)",
    api: "https://bdl.stat.gov.pl/api/v1",
    capturedAt,
    subject: { id: "P2137", name: subject.json.name, description: subject.json.description ?? null, lastUpdate: subject.json.lastUpdate ?? null },
    year,
    baseYear: base,
    variables: Object.fromEntries(
      Object.entries(varMeta).map(([k, m]) => [k, { id: m.id, n1: m.n1, n2: m.n2, unit: m.measureUnitName, subjectId: m.subjectId, verifiedAt: m.capturedAt }]),
    ),
    derived: {
      population: `zmienna ${VARS.total} (${varMeta.total!.n1}), stan na 31 XII ${year}`,
      pop65: `${VARS.age65_69} (65-69) + ${VARS.age70plus} (70 i więcej), ${year}`,
      pop80: `${VARS.age80_84} (80-84) + ${VARS.age85plus} (85 i więcej), ${year}`,
      popChange10y: `zmiana ludności ogółem ${base}→${year} w %, zaokrąglona do 0,1; liczona dla gminy w jej obecnym kodzie (lub poprzedniku o tym samym numerze i nazwie). Zmiany granic między gminami nie są korygowane.`,
      teryt: "id BDL [2..4] + [7..9] + [9..11] + [11] → WWPPGGR; sprawdzone z warstwą gmin PRG (repozytorium waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy)",
    },
    counts: {
      bdlLevel6Units: units.results.length,
      gminaUnitsKind123: gminaUnits.length,
      currentGminas: gminas.length,
      historicalUnitsSkipped: historical.map((h) => ({ bdlId: h.id, name: h.name })),
      byKind: gminas.reduce<Record<string, number>>((a, g) => ((a[g.kind] = (a[g.kind] ?? 0) + 1), a), {}),
      nulls: {
        population: gminas.filter((g) => g.population === null).length,
        pop65: gminas.filter((g) => g.pop65 === null).length,
        pop80: gminas.filter((g) => g.pop80 === null).length,
        popChange10y: gminas.filter((g) => g.popChange10y === null).length,
      },
    },
    predecessorPairings: pairings,
    unitNotes,
    popChange10yWithheld: [...noComparison.entries()].map(([id, d]) => ({ teryt: terytFromBdlId(id), bdlId: id, reason: `zmiana terytorium gminy po ${base} r.: ${d}` })),
    prgCheck: { checked: gminas.length, mismatches: prgMismatches },
    notes,
  });

  console.log(`gminas.json: ${gminas.length} gmin, rok ${year} (bazowy ${base})`);
  console.log(`  rodzaje: ${JSON.stringify(gminas.reduce<Record<string, number>>((a, g) => ((a[g.kind] = (a[g.kind] ?? 0) + 1), a), {}))}`);
  console.log(`  pominięte jednostki historyczne: ${historical.length}; pary z poprzednikiem: ${pairings.length}; niezgodności z PRG: ${prgMismatches.length}`);
  for (const m of prgMismatches) console.log(`    ${m}`);
  for (const n of notes) console.log(`  ${n}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
