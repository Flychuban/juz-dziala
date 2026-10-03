/**
 * Małopolska powiat boundaries → data/powiaty.topo.json (+ data/powiaty.json)
 *
 *   pnpm exec tsx scripts/build-geo.ts
 *
 * Source: waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy, file powiaty.json at the repo
 * root (path found through the GitHub trees API; both responses archived). Properties there are
 * JPT_KOD_JE (4-digit TERYT) and JPT_NAZWA_ („powiat krakowski", „powiat Kraków").
 *
 * Kept: TERYT starting "12" — exactly 22 powiats (19 ziemskie + Kraków 1261, Nowy Sącz 1262,
 * Tarnów 1263), checked below. Names: „powiat X" for a land powiat as in the source; for the
 * three cities with powiat rights the „powiat " prefix is dropped („Kraków").
 * Converted with mapshaper to TopoJSON (object "powiaty", properties {teryt, name}, quantization
 * 1e5, -clean) and simplified only as far as the ~120 KB budget requires: the source is already
 * rounded to 4 decimals, and at full detail the result is ~41 KB, so currently no vertex is
 * dropped. If the source ever grows, the loop below simplifies (Visvalingam, keep-shapes) step by
 * step until the file fits.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, RAW_DIR, politeFetch, writeJson } from "./lib/http";
import { Powiaty } from "./schemas";

const TREE_URL = "https://api.github.com/repos/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy/git/trees/main?recursive=1";
const RAW_BASE = "https://raw.githubusercontent.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy/main/";
const CITY_TERYT = new Set(["1261", "1262", "1263"]);
const MAX_BYTES = 110 * 1024; // budget ~120 KB, with a margin

type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };

async function main() {
  const tree = JSON.parse((await politeFetch(TREE_URL)).body.toString("utf8")) as { tree: { path: string; type: string }[] };
  const path = tree.tree.find((t) => t.type === "blob" && /(^|\/)powiaty\.json$/.test(t.path))?.path;
  if (!path) throw new Error("powiaty.json not found in the repository tree");
  const src = await politeFetch(RAW_BASE + path.split("/").map(encodeURIComponent).join("/"));
  const geo = JSON.parse(src.body.toString("utf8")) as { features: Feature[] };

  const features = geo.features
    .filter((f) => String(f.properties.JPT_KOD_JE).startsWith("12"))
    .map((f) => {
      const teryt = String(f.properties.JPT_KOD_JE);
      const raw = String(f.properties.JPT_NAZWA_).trim();
      const isCity = CITY_TERYT.has(teryt);
      const name = isCity ? raw.replace(/^powiat\s+/i, "") : raw;
      return { ...f, properties: { teryt, name, isCity } };
    })
    .sort((a, b) => a.properties.teryt.localeCompare(b.properties.teryt));

  if (features.length !== 22) throw new Error(`expected 22 Małopolska powiats, got ${features.length}`);
  for (const t of CITY_TERYT) if (!features.some((f) => f.properties.teryt === t)) throw new Error(`city powiat ${t} missing`);
  if (features.filter((f) => !f.properties.isCity).length !== 19) throw new Error("expected 19 land powiats");

  writeJson(
    "data/powiaty.json",
    Powiaty.parse(features.map((f) => f.properties)),
  );

  // mapshaper input/output live in data/raw/derived (gitignored); only the result is committed.
  const derived = join(RAW_DIR, "derived");
  mkdirSync(derived, { recursive: true });
  const input = join(derived, "malopolska-powiaty.geojson");
  writeFileSync(
    input,
    JSON.stringify({
      type: "FeatureCollection",
      features: features.map((f) => ({ ...f, properties: { teryt: f.properties.teryt, name: f.properties.name } })),
    }),
  );
  const out = join(ROOT, "data", "powiaty.topo.json");
  const bin = join(ROOT, "node_modules", ".bin", "mapshaper");
  let pct = 100; // start from full detail and simplify only as much as the size budget needs
  for (;;) {
    execFileSync(
      bin,
      [
        "-i", input, "name=powiaty",
        "-simplify", `${pct}%`, "keep-shapes",
        "-clean",
        "-o", out, "format=topojson", "quantization=100000", "force",
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    const size = statSync(out).size;
    console.log(`mapshaper simplify ${pct}% → ${(size / 1024).toFixed(1)} KB`);
    if (size <= MAX_BYTES || pct <= 2) break;
    pct = Math.max(2, Math.floor(pct * 0.8));
  }

  const topo = JSON.parse(readFileSync(out, "utf8")) as {
    objects: { powiaty: { geometries: { properties: { teryt: string; name: string } }[] } };
  };
  const geoms = topo.objects.powiaty.geometries;
  if (geoms.length !== 22) throw new Error(`TopoJSON has ${geoms.length} geometries, expected 22`);
  console.log(`powiaty.topo.json: ${geoms.length} powiatów; powiaty.json: ${features.length} (${features.filter((f) => f.properties.isCity).map((f) => f.properties.name).join(", ")} = miasta na prawach powiatu)`);
}

await main();
