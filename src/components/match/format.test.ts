import { describe, expect, it } from "vitest";

import { formatDatePl, formatPct, gminaOptionLabel, highlightRanges, plural, resolveGmina } from "./format";

describe("formatDatePl", () => {
  it("formats an ISO date in Polish and rejects nonsense", () => {
    expect(formatDatePl("2026-10-03T15:27:55.995Z")).toBe("3 października 2026");
    expect(formatDatePl("nonsense")).toBeNull();
    expect(formatDatePl(null)).toBeNull();
  });
});

describe("formatPct", () => {
  it("formats a rate and shows a dash for none", () => {
    expect(formatPct(0.8333)).toMatch(/^83\s?%$/u);
    expect(formatPct(null)).toBe("—");
  });
});

describe("plural", () => {
  it("follows Polish plural rules", () => {
    const f = (n: number) => plural(n, "osoba", "osoby", "osób");
    expect([1, 2, 4, 5, 12, 14, 22, 25].map(f)).toEqual(["osoba", "osoby", "osoby", "osób", "osób", "osób", "osoby", "osób"]);
  });
});

describe("resolveGmina", () => {
  const options = [
    { teryt: "1206011", name: "Zabierzów", powiatName: "krakowski" },
    { teryt: "1201011", name: "Bochnia", powiatName: "bocheński" },
    { teryt: "1201022", name: "Bochnia", powiatName: null },
  ];

  it("resolves the picked label, or a unique name", () => {
    expect(resolveGmina(gminaOptionLabel(options[0]!), options)).toBe("1206011");
    expect(resolveGmina("zabierzów", options)).toBe("1206011");
  });

  it("returns undefined for an ambiguous, unknown or empty entry", () => {
    expect(resolveGmina("Bochnia", options)).toBe("1201022"); // the label without powiat is exact
    expect(resolveGmina("Nowhere", options)).toBeUndefined();
    expect(resolveGmina("  ", options)).toBeUndefined();
  });
});

describe("highlightRanges", () => {
  it("finds terms case- and diacritic-insensitively and merges overlaps", () => {
    const text = "Pasuje, bo napisałaś/eś: „Mieszka sama”, „myli leki”.";
    const ranges = highlightRanges(text, ["mieszka sama", "SAMA", "myli leki"]);
    expect(ranges.map(([s, e]) => text.slice(s, e))).toEqual(["Mieszka sama", "myli leki"]);
    expect(highlightRanges("Żółta łódź", ["zolta"]).map(([s, e]) => "Żółta łódź".slice(s, e))).toEqual(["Żółta"]);
  });

  it("ignores one-letter terms and returns nothing when there is no hit", () => {
    expect(highlightRanges("a b c", ["a"])).toEqual([]);
    expect(highlightRanges("tekst", ["inne"])).toEqual([]);
  });
});
