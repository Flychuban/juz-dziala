import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  computeRegionFigures,
  parseGminaStats,
  regionalChange,
} from "./region";

const read = (f: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "data", f), "utf8")) as unknown;

describe("computeRegionFigures (data/gminas.json)", () => {
  const r = computeRegionFigures(read("gminas.json"), read("gus.meta.json"))!;

  it("sums every gmina and states the year and capture date from gus.meta.json", () => {
    expect(r.gminaCount).toBe(183);
    expect(r.year).toBe(2025);
    expect(r.baseYear).toBe(2015);
    expect(r.capturedAt).toMatch(/^2026-/);
    expect(r.population).toBeGreaterThan(3_000_000);
  });

  it("gives shares that follow from the sums", () => {
    expect(r.share65).toBe(Math.round((r.pop65 / r.population) * 1000) / 10);
    expect(r.share80).toBeLessThan(r.share65);
  });

  it("leaves out gminas whose borders changed and says which", () => {
    expect(r.change?.gminas).toBe(181);
    expect(r.change?.pct).toBeCloseTo(1.7, 5);
    expect(r.change?.excluded.sort()).toEqual(["Kamienica", "Szczawa"]);
    expect(r.depopulating.of).toBe(181);
  });

  it("ranks the fastest-growing gminas and checks they are around Kraków", () => {
    expect(r.fastestGrowing).toHaveLength(5);
    expect(r.fastestGrowing[0]!.value).toBeGreaterThanOrEqual(
      r.fastestGrowing[4]!.value,
    );
    expect(r.fastestAroundKrakow).toBe(true);
  });
});

describe("regionalChange", () => {
  const g = (population: number, popChange10y: number | null) => ({
    teryt: "1201011",
    name: "X",
    kind: null,
    powiatTeryt: "1201",
    powiatName: null,
    population,
    pop65: 0,
    pop80: 0,
    popChange10y,
  });
  it("weights by population", () => {
    expect(regionalChange([g(110, 10), g(90, -10)])?.pct).toBe(0);
  });
  it("is exact when the rounding of each gmina cannot move the first decimal", () => {
    expect(regionalChange([g(1100, 10)])).toEqual({
      pct: 10,
      approx: false,
      gminas: 1,
    });
  });
  it("is marked approximate when the rounding could move the first decimal", () => {
    expect(regionalChange([g(110, 10), g(90, -10)])?.approx).toBe(true);
  });
  it("returns null without comparable gminas", () => {
    expect(regionalChange([g(100, null)])).toBeNull();
  });
});

describe("parseGminaStats", () => {
  it("skips rows without numbers instead of inventing them", () => {
    expect(
      parseGminaStats([{ teryt: "1201011", name: "A", population: 10 }]),
    ).toEqual([]);
    expect(parseGminaStats(null)).toEqual([]);
  });
});
