import { describe, expect, it } from "vitest";

import { countPl, fold, formatDatePl, pluralPl, spellCode } from "./format";
import { findTermRanges } from "./terms";
import { youtubeId } from "./youtube";

const marked = (text: string, terms: string[]) =>
  findTermRanges(text, terms).map(([s, e]) => text.slice(s, e));

describe("findTermRanges", () => {
  it("ignores case and Polish diacritics", () => {
    expect(
      marked("Pani Janina mieszka SAMA w Żłobku.", ["mieszka sama", "zlobku"]),
    ).toEqual(["mieszka SAMA", "Żłobku"]);
  });
  it("matches at word starts only and extends a stem to the whole word", () => {
    expect(marked("Samotnie, ale nie przesamotnie.", ["samotn"])).toEqual([
      "Samotnie",
    ]);
  });
  it("merges overlapping ranges", () => {
    expect(
      findTermRanges("opieka wytchnieniowa", ["opieka", "opieka wytch"]),
    ).toEqual([[0, 20]]);
  });
  it("skips one-letter terms", () => {
    expect(findTermRanges("a b c", ["a"])).toEqual([]);
  });
});

describe("Polish formatting", () => {
  it("picks the right plural form", () => {
    const f = (n: number) =>
      pluralPl(n, "rozwiązanie", "rozwiązania", "rozwiązań");
    expect([1, 2, 4, 5, 12, 14, 22, 25, 114].map(f)).toEqual([
      "rozwiązanie",
      "rozwiązania",
      "rozwiązania",
      "rozwiązań",
      "rozwiązań",
      "rozwiązań",
      "rozwiązania",
      "rozwiązań",
      "rozwiązań",
    ]);
    expect(countPl(5, "rozwiązanie", "rozwiązania", "rozwiązań")).toBe(
      "5 rozwiązań",
    );
  });
  it("formats dates in Polish", () => {
    expect(formatDatePl("2026-10-03T10:00:00Z")).toBe("3 października 2026");
    expect(formatDatePl("not a date")).toBe("");
  });
  it("folds diacritics", () => {
    expect(fold("Łódź Żółć")).toBe("lodz zolc");
  });
  it("spells a case code", () => {
    expect(spellCode("JD-7K")).toBe("J D myślnik 7 K");
  });
});

describe("youtubeId", () => {
  it("reads watch, short and embed URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=o7UhDlebLJo")).toBe(
      "o7UhDlebLJo",
    );
    expect(youtubeId("https://youtu.be/o7UhDlebLJo")).toBe("o7UhDlebLJo");
    expect(youtubeId("https://www.youtube.com/embed/o7UhDlebLJo?x=1")).toBe(
      "o7UhDlebLJo",
    );
    expect(youtubeId("https://example.com/watch?v=o7UhDlebLJo")).toBeNull();
  });
});
