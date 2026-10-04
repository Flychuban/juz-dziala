import { describe, expect, it } from "vitest";

import {
  isUnmet,
  powiatName,
  summarize,
  weekStart,
  whiteSpots,
  type Need,
} from "./needs";

const need = (p: Partial<Need>): Need => ({
  source: "run",
  at: new Date("2026-09-30T10:00:00Z"),
  areas: ["seniors"],
  powiat: "1204",
  text: "Na wieś nie dojeżdża autobus.",
  unmet: false,
  isSample: true,
  ...p,
});

describe("isUnmet", () => {
  it("counts an abstained run as a white spot", () => {
    expect(
      isUnmet({
        abstained: true,
        status: "abstained",
        keywordResult: {},
        aiResult: null,
      }),
    ).toBe(true);
  });
  it("counts a low-confidence keyword run without AI matches", () => {
    expect(
      isUnmet({
        abstained: false,
        status: "keyword",
        keywordResult: { isLowConfidence: true, results: [{ cardId: "c001" }] },
        aiResult: null,
      }),
    ).toBe(true);
  });
  it("reads the matcher's stored shape (hits, v1)", () => {
    const kw = (isLowConfidence: boolean, hits: unknown[]) => ({
      v: 1,
      hits,
      detectedAreas: [],
      isLowConfidence,
      userTerms: [],
    });
    expect(
      isUnmet({
        abstained: false,
        status: "keyword",
        keywordResult: kw(false, [{ cardId: "c001" }]),
        aiResult: null,
      }),
    ).toBe(false);
    expect(
      isUnmet({
        abstained: false,
        status: "keyword",
        keywordResult: kw(true, [{ cardId: "c001" }]),
        aiResult: null,
      }),
    ).toBe(true);
    expect(
      isUnmet({
        abstained: false,
        status: "ai",
        keywordResult: kw(false, [{ cardId: "c001" }]),
        aiResult: { v: 1, ok: true, matches: [], abstained: true },
      }),
    ).toBe(true);
  });
  it("does not count a confident match, or a low-confidence one the AI answered", () => {
    expect(
      isUnmet({
        abstained: false,
        status: "keyword",
        keywordResult: { isLowConfidence: false, results: [{}] },
        aiResult: null,
      }),
    ).toBe(false);
    expect(
      isUnmet({
        abstained: false,
        status: "ai",
        keywordResult: { isLowConfidence: true, results: [] },
        aiResult: { matches: [{ innovationId: "c001" }] },
      }),
    ).toBe(false);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart(new Date("2026-10-03T12:00:00Z"))).toBe("2026-09-28"); // Saturday
    expect(weekStart(new Date("2026-09-28T00:30:00Z"))).toBe("2026-09-28"); // Monday
    expect(weekStart(new Date("2026-10-04T23:00:00Z"))).toBe("2026-09-28"); // Sunday
  });
});

describe("summarize and whiteSpots", () => {
  const needs = [
    need({ unmet: true }),
    need({ unmet: true, text: "Brakuje dowozu do lekarza." }),
    need({ powiat: "1261", areas: ["disability", "family"], unmet: false }),
    need({
      powiat: null,
      areas: [],
      unmet: true,
      at: new Date("2026-09-20T10:00:00Z"),
    }),
  ];
  it("counts per powiat, per area (multi-area needs in each) and per week", () => {
    const s = summarize(needs);
    expect(s.total).toBe(4);
    expect(s.unmet).toBe(3);
    expect(s.byPowiat).toEqual({ "1204": 2, "1261": 1 });
    expect(s.byArea.find((a) => a.area === "seniors")).toMatchObject({
      count: 2,
      unmet: 2,
    });
    expect(s.byArea.find((a) => a.area === "family")).toMatchObject({
      count: 1,
      unmet: 0,
    });
    expect(s.byArea.find((a) => a.area === "none")).toMatchObject({
      count: 1,
      unmet: 1,
    });
    expect(s.byWeek).toEqual([
      { week: "2026-09-14", count: 1, unmet: 1 },
      { week: "2026-09-28", count: 3, unmet: 2 },
    ]);
  });
  it("groups unmet needs by area × powiat, largest first, with examples", () => {
    const spots = whiteSpots(needs);
    expect(spots[0]).toMatchObject({
      area: "seniors",
      powiat: "1204",
      count: 2,
      powiatName: "powiat dąbrowski",
    });
    expect(spots[0]!.examples).toHaveLength(2);
  });
  it("leaves needs without a Mapa area out of the white spots", () => {
    const spots = whiteSpots(needs);
    expect(spots).toHaveLength(1);
    expect(spots.some((s) => s.area === "none")).toBe(false);
  });
  it("labels areas and powiats in English", () => {
    const [spot] = whiteSpots(needs, "en");
    expect(spot).toMatchObject({
      areaLabel: "Older people",
      powiatName: "Dąbrowa Tarnowska County",
    });
    expect(
      summarize(needs, "en").byArea.find((a) => a.area === "none")?.label,
    ).toBe("No area assigned");
  });
  it("names city powiats without the word „powiat”", () => {
    expect(powiatName("1261")).toBe("Kraków");
    expect(powiatName("1201")).toBe("powiat bocheński");
    expect(powiatName(null, "en")).toBe("not given");
  });
});
