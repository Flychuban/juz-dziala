import { describe, expect, it } from "vitest";
import { FIXTURE_CARDS } from "./__fixtures__/cards";
import { isMapaArea, libraryCardSchema, MAPA_AREAS, SECTION_KEYS } from "./types";

describe("libraryCardSchema", () => {
  it("accepts a well-formed card", () => {
    expect(libraryCardSchema.safeParse(FIXTURE_CARDS[0]).success).toBe(true);
  });

  it("rejects a card with a missing section or an unknown area", () => {
    const card = FIXTURE_CARDS[0]!;
    const partialSections: Partial<typeof card.sections> = { ...card.sections };
    delete partialSections.authors;
    expect(libraryCardSchema.safeParse({ ...card, sections: partialSections }).success).toBe(false);
    expect(libraryCardSchema.safeParse({ ...FIXTURE_CARDS[0], mapaAreas: ["elsewhere"] }).success).toBe(false);
  });

  it("rejects a sentence in an unknown section", () => {
    const bad = { ...FIXTURE_CARDS[0], sentences: [{ id: "c001.s1", section: "intro", text: "x" }] };
    expect(libraryCardSchema.safeParse(bad).success).toBe(false);
  });
});

describe("isMapaArea", () => {
  it("recognises the eight Mapa areas only", () => {
    expect(MAPA_AREAS).toHaveLength(8);
    for (const a of MAPA_AREAS) expect(isMapaArea(a)).toBe(true);
    expect(isMapaArea("loneliness")).toBe(false);
    expect(isMapaArea(3)).toBe(false);
  });
});

describe("SECTION_KEYS", () => {
  it("lists the six card sections", () => {
    expect(SECTION_KEYS).toEqual(["solution", "problems", "targetGroup", "whoCanUse", "doesItWork", "authors"]);
  });
});
