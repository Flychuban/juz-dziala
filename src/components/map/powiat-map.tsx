import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { geoArea, geoMercator, geoPath } from "d3-geo";
import { getLocale, getTranslations } from "next-intl/server";
import { feature } from "topojson-client";
import { type GeometryCollection, type Topology } from "topojson-specification";

import { cn } from "~/lib/utils";
import { PowiatMapSvg, type MapShape } from "./powiat-map-svg";
import { POWIAT_NAMES, POWIAT_NAMES_EN, powiatKey } from "./powiaty";

type PowiatProps = { teryt?: string | number; name?: string };

const WIDTH = 600;
const PAD = 6;

/** Loads data/powiaty.topo.json (kept once loaded); null while it is missing. */
let cache: Topology | null = null;
async function loadTopology(): Promise<Topology | null> {
  if (cache) return cache;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "powiaty.topo.json"),
      "utf8",
    );
    const t = JSON.parse(raw) as Topology;
    if (t?.objects?.powiaty) cache = t;
    return cache;
  } catch {
    return null;
  }
}

const NUM: Record<"pl" | "en", Intl.NumberFormat> = {
  pl: new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }),
};

type Bin = { from: number; to: number; label: string; fill: string };

/** Sequential bins: one hue (primary) mixed into the background, light → dark. */
function makeBins(values: number[], num: Intl.NumberFormat): Bin[] {
  const pos = [...new Set(values.filter((v) => v > 0))].sort((a, b) => a - b);
  if (pos.length === 0) return [];
  const shade = (i: number, n: number) => {
    const pct = n === 1 ? 100 : Math.round(25 + (75 * i) / (n - 1));
    return `color-mix(in srgb, var(--primary) ${pct}%, var(--background))`;
  };
  if (pos.length <= 5) {
    return pos.map((v, i) => ({
      from: v,
      to: v,
      label: num.format(v),
      fill: shade(i, pos.length),
    }));
  }
  const lo = pos[0]!;
  const hi = pos.at(-1)!;
  const integers = pos.every((v) => Number.isInteger(v));
  const n = 5;
  const step = (hi - lo) / n;
  const bins: Bin[] = [];
  for (let i = 0; i < n; i++) {
    let from = lo + step * i;
    let to = i === n - 1 ? hi : lo + step * (i + 1);
    if (integers) {
      from = i === 0 ? lo : Math.floor(bins[i - 1]!.to) + 1;
      to = i === n - 1 ? hi : Math.max(from, Math.floor(lo + step * (i + 1)));
    }
    bins.push({
      from,
      to,
      label:
        from === to ? num.format(from) : `${num.format(from)}–${num.format(to)}`,
      fill: shade(i, n),
    });
  }
  return bins;
}

function binFor(bins: Bin[], v: number) {
  return bins.find((b) => v >= b.from && v <= b.to) ?? bins.at(-1);
}

/**
 * „powiat bocheński" for land powiats, „Kraków" for cities (from the map or
 * the fallback list); in English "Bochnia County" / "Kraków".
 */
function fullName(key: string, name?: string, locale = "pl") {
  if (locale === "en" && POWIAT_NAMES_EN[key]) return POWIAT_NAMES_EN[key];
  const n = (name ?? POWIAT_NAMES[key] ?? key).trim();
  if (/^powiat\s/i.test(n))
    return n.replace(/^powiat\s+(m\.\s*)?/i, (_m, city: string | undefined) =>
      city ? "" : "powiat ",
    );
  return key.startsWith("126") ? n : `powiat ${n}`;
}

/**
 * PowiatMap — a choropleth of the 22 powiats of Małopolska with a legend
 * and, always, a data table (<table> with caption) as the accessible
 * alternative. Each powiat is focusable with the label „Powiat X: N" (cities:
 * „Kraków: N"); hover
 * or focus shows the value under the map.
 *
 * Server component: reads data/powiaty.topo.json (object `powiaty`, properties
 * `{teryt, name}`). Without that file it renders the table alone with a note.
 * Colours come from tokens (ROPS blue mixed into the background), so high
 * contrast mode works without extra code.
 *
 * @param values          TERYT (4-digit powiat code, or longer — the first 4 digits are used) → number.
 * @param label           What the numbers are, e.g. „Zgłoszone potrzeby w 2026 r." (table caption, map name).
 * @param highlight       TERYT codes to outline in the accent colour (e.g. the user's powiat).
 * @param highlightLabel  Word shown in the table for highlighted rows; default „wyróżniony" / "highlighted".
 * @param valueLabel      Table column header for the numbers; default „Liczba" / "Number".
 * @param hrefFor         Optional link per powiat (server-side function), e.g. teryt => `/municipality/${teryt}`.
 * @param source          Optional source line rendered under the map (pass a <SourceLine/>).
 */
export async function PowiatMap({
  values,
  label,
  highlight = [],
  highlightLabel,
  valueLabel,
  hrefFor,
  source,
  className,
}: {
  values: Record<string, number>;
  label: string;
  highlight?: string[];
  highlightLabel?: string;
  valueLabel?: string;
  hrefFor?: (teryt: string) => string | null | undefined;
  source?: React.ReactNode;
  className?: string;
}) {
  const t = await getTranslations("municipality.map");
  const locale = (await getLocale()) === "en" ? "en" : "pl";
  const num = NUM[locale];
  highlightLabel ??= t("highlighted");
  valueLabel ??= t("value");
  const vals = new Map<string, number>();
  for (const [k, v] of Object.entries(values)) {
    if (Number.isFinite(v)) vals.set(powiatKey(k), v);
  }
  const hl = new Set(highlight.map(powiatKey));
  const bins = makeBins([...vals.values()], num);

  const topo = await loadTopology();
  let shapes: MapShape[] = [];
  let height = 0;
  const names = new Map<string, string>(
    Object.keys(POWIAT_NAMES).map((k) => [k, fullName(k, undefined, locale)]),
  );

  if (topo) {
    try {
      const fc = feature(
        topo,
        topo.objects.powiaty as GeometryCollection<PowiatProps>,
      );
      // d3 expects clockwise exterior rings; rewind any feature that came
      // out inverted (its spherical area would exceed a hemisphere).
      for (const f of fc.features) {
        if (geoArea(f) > 2 * Math.PI) rewind(f.geometry);
      }
      const projection = geoMercator().fitWidth(WIDTH - PAD * 2, fc);
      const gen = geoPath(projection);
      const [[, y0], [, y1]] = gen.bounds(fc);
      height = Math.ceil(y1 - y0) + PAD * 2;
      projection.translate([
        projection.translate()[0] + PAD,
        projection.translate()[1] - y0 + PAD,
      ]);
      shapes = fc.features.flatMap((f) => {
        const key = powiatKey(String(f.properties?.teryt ?? ""));
        const d = gen(f);
        if (!key || !d) return [];
        const name = f.properties?.name
          ? fullName(key, f.properties.name, locale)
          : fullName(key, undefined, locale);
        names.set(key, name);
        const v = vals.get(key);
        return [
          {
            key,
            name,
            d,
            value: v ?? null,
            fill:
              v === undefined
                ? "var(--background)"
                : v <= 0
                  ? "var(--surface)"
                  : (binFor(bins, v)?.fill ?? "var(--surface)"),
            highlighted: hl.has(key),
            href: hrefFor?.(key) ?? null,
          },
        ];
      });
    } catch (e) {
      console.warn("[PowiatMap] could not draw data/powiaty.topo.json", e);
      shapes = [];
    }
  }

  const rows = [...names.entries()]
    .map(([key, name]) => ({ key, name, value: vals.get(key) ?? null }))
    .sort(
      (a, b) =>
        (b.value ?? -Infinity) - (a.value ?? -Infinity) ||
        a.name.localeCompare(b.name, locale),
    );
  const anyMissing = rows.some((r) => r.value === null);
  const anyZero = rows.some((r) => r.value !== null && r.value <= 0);

  return (
    <div
      data-slot="powiat-map"
      className={cn(
        "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        className,
      )}
    >
      <div>
        {shapes.length > 0 ? (
          <PowiatMapSvg
            width={WIDTH}
            height={height}
            shapes={shapes}
            label={label}
            locale={locale}
          />
        ) : (
          <p className="border-input bg-surface rounded-md border border-dashed p-4">
            {t("unavailable")}
          </p>
        )}
        {shapes.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-bold">
              {t("legend", { label: valueLabel.toLowerCase() })}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {bins.map((b) => (
                <li key={b.label} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="border-input inline-block size-5 rounded-sm border"
                    style={{ background: b.fill }}
                  />
                  <span className="tabular">{b.label}</span>
                </li>
              ))}
              {anyZero ? (
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="border-input bg-surface inline-block size-5 rounded-sm border"
                  />
                  0
                </li>
              ) : null}
              {anyMissing ? (
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="border-input bg-background inline-block size-5 rounded-sm border border-dashed"
                  />
                  {t("noData")}
                </li>
              ) : null}
              {hl.size > 0 ? (
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="border-brand-accent inline-block size-5 rounded-sm border-[3px]"
                  />
                  {highlightLabel}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {source ? <div className="mt-4">{source}</div> : null}
      </div>

      <div className="border-hairline overflow-x-auto rounded-md border">
        <table className="tabular w-full border-collapse text-[0.9375rem]">
          <caption className="border-hairline border-b px-4 py-3 text-left text-base font-bold">
            {label}
          </caption>
          <thead className="bg-surface">
            <tr className="border-hairline border-b">
              <th scope="col" className="px-4 py-2 text-left font-semibold">
                {t("colPowiat")}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = hrefFor?.(r.key);
              return (
                <tr
                  key={r.key}
                  className={cn(
                    "border-hairline border-b last:border-0",
                    hl.has(r.key) && "bg-accent",
                  )}
                >
                  <th scope="row" className="px-4 py-1.5 text-left font-normal">
                    {href ? (
                      <a
                        href={href}
                        className="inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                      >
                        {r.name}
                      </a>
                    ) : (
                      r.name
                    )}
                    {hl.has(r.key) ? (
                      <span className="border-brand-accent text-foreground ml-2 rounded-sm border px-1 text-sm font-semibold">
                        {highlightLabel}
                      </span>
                    ) : null}
                  </th>
                  <td className="px-4 py-1.5 text-right">
                    {r.value === null ? (
                      <span className="text-muted-foreground">{t("noData")}</span>
                    ) : (
                      num.format(r.value)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Reverses every ring of a (Multi)Polygon in place. */
function rewind(g: GeoJSON.Geometry | null) {
  if (!g) return;
  if (g.type === "Polygon") g.coordinates.forEach((r) => r.reverse());
  else if (g.type === "MultiPolygon")
    g.coordinates.forEach((p) => p.forEach((r) => r.reverse()));
}
