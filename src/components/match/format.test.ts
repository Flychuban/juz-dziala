import { describe, expect, it } from "vitest";

import {
  caseBody,
  caseTitle,
  filterGminas,
  formatPct,
  gminaOptionLabel,
  knowledgeDetail,
  shortCallName,
  type GminaOption,
} from "./format";

describe("formatPct", () => {
  it("formats a rate and shows a dash for none", () => {
    expect(formatPct(0.8333)).toMatch(/^83\s?%$/u);
    expect(formatPct(null)).toBe("—");
  });
});

describe("shortCallName", () => {
  it("takes the quoted project name and drops its subtitle", () => {
    expect(
      shortCallName("Nabór aplikacji (wniosków) na innowacje społeczne w ramach projektu pn. „Inkubator Włączenia Społecznego 2.0”"),
    ).toBe("Inkubator Włączenia Społecznego 2.0");
    expect(shortCallName("projektu „Usługa Wrażliwa – upowszechnianie innowacji społecznych”")).toBe("Usługa Wrażliwa");
    expect(shortCallName("Nabór przykładowy (demo) — granty")).toBe("Nabór przykładowy (demo) — granty");
  });
});

const OPTIONS: GminaOption[] = [
  { teryt: "1201011", name: "Bochnia", kind: "miejska", powiatName: "powiat bocheński" },
  { teryt: "1201022", name: "Bochnia", kind: "wiejska", powiatName: "powiat bocheński" },
  { teryt: "1206011", name: "Zabierzów", kind: "wiejska", powiatName: "powiat krakowski" },
  { teryt: "1207011", name: "Limanowa", kind: "miejska", powiatName: "powiat limanowski" },
];

describe("gminaOptionLabel", () => {
  it("tells apart gminas that share a name", () => {
    expect(gminaOptionLabel(OPTIONS[0]!)).toBe("Bochnia — gmina miejska, powiat bocheński");
    expect(gminaOptionLabel(OPTIONS[1]!)).toBe("Bochnia — gmina wiejska, powiat bocheński");
    expect(gminaOptionLabel({ teryt: "1", name: "X", kind: null, powiatName: null })).toBe("X");
  });
});

describe("filterGminas", () => {
  it("matches without diacritics, prefix matches first, then powiat", () => {
    expect(filterGminas("zabierzow", OPTIONS).map((g) => g.teryt)).toEqual(["1206011"]);
    expect(filterGminas("lima", OPTIONS).map((g) => g.teryt)).toEqual(["1207011"]);
    expect(filterGminas("bocheński", OPTIONS).map((g) => g.teryt)).toEqual(["1201011", "1201022"]);
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(filterGminas("  ", OPTIONS)).toEqual([]);
    expect(filterGminas("o", OPTIONS, 2)).toHaveLength(2);
  });
});

describe("caseTitle", () => {
  it("takes the first sentence and cuts long ones at a word", () => {
    expect(caseTitle("Mama mieszka sama. Myli leki.")).toBe("Mama mieszka sama.");
    const long = caseTitle("słowo ".repeat(40));
    expect(long.length).toBeLessThanOrEqual(81);
    expect(long.endsWith("słowo…")).toBe(true);
    expect(caseTitle("ok")).toBe("Prośba o pomoc");
  });
});

describe("caseBody", () => {
  it("always carries the description and says what was shown", () => {
    expect(caseBody("wózek", ["Uniodzież"], false)).toBe("Opis (bez danych osobowych): wózek\nPokazane rozwiązania: „Uniodzież”.");
    expect(caseBody("dziura w drodze", [], true)).toContain("brak pewnego dopasowania");
    expect(caseBody("abc", [], false).length).toBeGreaterThanOrEqual(10);
  });
});

describe("knowledgeDetail", () => {
  it("prints the page and the month of the source, never a day", () => {
    expect(knowledgeDetail("4", "2024-11")).toBe("s. 4, wydanie: listopad 2024");
    expect(knowledgeDetail(null, null)).toBeNull();
    expect(knowledgeDetail(null, "nonsense")).toBeNull();
  });
});
