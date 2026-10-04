import { describe, expect, it } from "vitest";

import {
  englishStem,
  highlightTerms,
  prefixRe,
  queryStems,
  queryWords,
} from "./search";

describe("queryStems (Polish)", () => {
  it("stems inflected Polish words and drops stopwords", () => {
    expect(queryStems("samotność seniorów dla")).toEqual(["samotn", "senio"]);
  });
});

describe("englishStem", () => {
  it("makes singular and plural meet", () => {
    for (const [a, b] of [
      ["families", "family"],
      ["carers", "carer"],
      ["services", "service"],
      ["disabilities", "disability"],
    ] as const) {
      expect(prefixRe(englishStem(a)).test(b)).toBe(true);
      expect(prefixRe(englishStem(b)).test(a)).toBe(true);
    }
  });
  it("leaves short words and double s alone", () => {
    expect(englishStem("bus")).toBe("bus");
    expect(englishStem("loneliness")).toBe("loneliness");
  });
});

describe("queryWords", () => {
  it("is unchanged Polish stemming in Polish mode", () => {
    expect(queryWords("samotność seniorów", "pl")).toEqual([
      { pl: "samotn", en: null },
      { pl: "senio", en: null },
    ]);
  });
  it("gives each word an English and a Polish stem in English mode, without English stopwords", () => {
    expect(queryWords("loneliness of the older people", "en")).toEqual([
      { pl: "lonelin", en: "loneliness" },
      { pl: "olde", en: "older" },
      { pl: "peopl", en: "people" },
    ]);
  });
  it("highlights both stems", () => {
    expect(highlightTerms("carers seniorzy", "en")).toEqual([
      "carer",
      "seniorz",
      "senio",
    ]);
  });
});
