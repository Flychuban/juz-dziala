import { describe, expect, it } from "vitest";

import { parseCallInnovations, parseGminas, parseKnowledge, powiatOf } from "./data-files";

describe("parseKnowledge", () => {
  const source = { title: "Mapa Wyzwań Społecznych Małopolski", url: "https://example.org/mapa.pdf" };

  it("reads the Mapa Wyzwań figure shape with the document's date", () => {
    const facts = parseKnowledge({
      source: { ...source, date: "2024-11" },
      areas: [{ key: "family", label: "Rodzina", figures: [{ value: "3,5%", label: "Wzrost liczby dzieci w pieczy", scope: "Polska", year: "2023", page: 4 }] }],
    });
    expect(facts.get("family")).toMatchObject({
      text: "Wzrost liczby dzieci w pieczy: 3,5% (Polska, 2023)",
      sourceDate: "2024-11",
      page: "4",
    });
  });

  it("takes the first figure of an area, with the document's source", () => {
    const facts = parseKnowledge({
      source,
      areas: [{ key: "seniors", label: "Seniorzy", figures: ["Co czwarty mieszkaniec ma 60+ lat."], keyChallenges: ["x"], pages: [12] }],
    });
    expect(facts.get("seniors")).toEqual({
      area: "seniors",
      areaLabel: "Seniorzy",
      text: "Co czwarty mieszkaniec ma 60+ lat.",
      sourceTitle: source.title,
      sourceUrl: source.url,
      sourceDate: null,
      page: "12",
    });
  });

  it("reads structured figures and their own source", () => {
    const facts = parseKnowledge({
      source,
      areas: [
        {
          key: "homelessness",
          label: "Bezdomność",
          figures: [{ label: "Osoby w kryzysie bezdomności", value: 1234, unit: "osób", region: "Małopolska", year: 2024, source: { title: "GUS", url: "https://stat.gov.pl" } }],
        },
      ],
    });
    expect(facts.get("homelessness")).toMatchObject({
      text: "Osoby w kryzysie bezdomności: 1234 osób (Małopolska, 2024)",
      sourceTitle: "GUS",
      sourceUrl: "https://stat.gov.pl",
    });
  });

  it("falls back to a key challenge, skips unknown areas, and never shows an unsourced fact", () => {
    const facts = parseKnowledge({
      source,
      areas: [
        { key: "family", label: "Rodzina", figures: [], keyChallenges: ["Brakuje rodzin zastępczych."] },
        { key: "elsewhere", figures: ["x"] },
      ],
    });
    expect(facts.get("family")?.text).toBe("Brakuje rodzin zastępczych.");
    expect(facts.size).toBe(1);
    expect(parseKnowledge({ areas: [{ key: "health", figures: ["bez źródła"] }] }).size).toBe(0);
  });

  it("returns nothing for a missing or malformed file", () => {
    expect(parseKnowledge(null).size).toBe(0);
    expect(parseKnowledge({ areas: "nope" }).size).toBe(0);
  });
});

describe("parseCallInnovations", () => {
  it("maps each call to the card ids it lists", () => {
    const m = parseCallInnovations([
      { id: "usluga-wrazliwa-1", innovations: [{ slug: "bez-presji-z-depresji", cardId: "c005" }, { cardId: "c087" }] },
      { id: "iws-2-0", innovations: [] },
      { id: "broken" },
    ]);
    expect([...m.keys()]).toEqual(["usluga-wrazliwa-1"]);
    expect(m.get("usluga-wrazliwa-1")).toEqual(new Set(["c005", "c087"]));
    expect(parseCallInnovations(null).size).toBe(0);
  });
});

describe("powiatOf", () => {
  it("takes województwo + powiat from a gmina TERYT", () => {
    expect(powiatOf("1206011")).toBe("1206");
    expect(powiatOf("120601")).toBe("1206");
    expect(powiatOf("12")).toBeNull();
    expect(powiatOf(null)).toBeNull();
  });
});

describe("parseGminas", () => {
  it("accepts the common shapes, sorts by Polish name and dedupes", () => {
    const list = parseGminas({
      gminas: [
        { teryt: "1206011", name: "Zabierzów", powiat: "krakowski" },
        { code: "1261011", nazwa: "Kraków", powiatName: "m. Kraków" },
        { teryt: "1206011", name: "Zabierzów" },
        { name: "bez kodu" },
      ],
    });
    expect(list).toEqual([
      { teryt: "1261011", name: "Kraków", kind: null, powiatTeryt: "1261", powiatName: "m. Kraków" },
      { teryt: "1206011", name: "Zabierzów", kind: null, powiatTeryt: "1206", powiatName: "krakowski" },
    ]);
  });

  it("reads the real data/gminas.json shape (kind, powiatTeryt, powiatName)", () => {
    expect(
      parseGminas([
        { teryt: "1201011", name: "Bochnia", kind: "miejska", powiatTeryt: "1201", powiatName: "powiat bocheński" },
      ]),
    ).toEqual([{ teryt: "1201011", name: "Bochnia", kind: "miejska", powiatTeryt: "1201", powiatName: "powiat bocheński" }]);
  });

  it("returns an empty list for anything else", () => {
    expect(parseGminas(null)).toEqual([]);
    expect(parseGminas({ other: [] })).toEqual([]);
  });
});
