import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { geoArea, geoMercator, geoPath } from "d3-geo";
import { feature, merge, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

/**
 * A small, quiet outline of Małopolska with its powiat borders, drawn on the
 * server from data/powiaty.topo.json. Decorative next to the home page hero;
 * the figures beside it carry the information. Renders nothing without the file.
 */
const WIDTH = 320;
const PAD = 4;

type Drawn = { outline: string; borders: string; height: number; count: number };
let cache: Drawn | null | undefined;

function rewind(g: GeoJSON.Geometry | null) {
  if (!g) return;
  if (g.type === "Polygon") g.coordinates.forEach((r) => r.reverse());
  else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach((r) => r.reverse()));
}

async function draw(): Promise<Drawn | null> {
  if (cache !== undefined) return cache;
  try {
    const topo = JSON.parse(await readFile(path.join(process.cwd(), "data", "powiaty.topo.json"), "utf8")) as Topology;
    const obj = topo.objects.powiaty as GeometryCollection;
    const fc = feature(topo, obj);
    for (const f of fc.features) if (geoArea(f) > 2 * Math.PI) rewind(f.geometry);
    const outer = merge(topo, obj.geometries as Parameters<typeof merge>[1]);
    if (geoArea(outer) > 2 * Math.PI) rewind(outer);
    const inner = mesh(topo, obj, (a, b) => a !== b);
    const projection = geoMercator().fitWidth(WIDTH - PAD * 2, fc);
    const gen = geoPath(projection);
    const [[, y0], [, y1]] = gen.bounds(fc);
    projection.translate([projection.translate()[0] + PAD, projection.translate()[1] - y0 + PAD]);
    cache = {
      outline: gen(outer) ?? "",
      borders: gen(inner) ?? "",
      height: Math.ceil(y1 - y0) + PAD * 2,
      count: obj.geometries.length,
    };
  } catch (e) {
    console.warn("[home] could not draw data/powiaty.topo.json", e);
    cache = null;
  }
  return cache;
}

export async function powiatCount(): Promise<number | null> {
  return (await draw())?.count ?? null;
}

export async function MalopolskaOutline({ className }: { className?: string }) {
  const d = await draw();
  if (!d) return null;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${d.height}`} aria-hidden="true" focusable="false" className={className}>
      <path d={d.outline} fill="var(--surface)" stroke="none" />
      <path
        d={d.borders}
        fill="none"
        stroke="var(--input)"
        strokeWidth={0.75}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d.outline}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
