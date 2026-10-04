import { describe, expect, it } from "vitest";

import { isStopwordEn, processTermEn, stemEn } from "./english";

describe("stemEn", () => {
  it.each([
    ["lonely", "loneliness"],
    ["family", "families"],
    ["disabled", "disability"],
    ["disabilities", "disable"],
    ["isolated", "isolation"],
    ["depressed", "depression"],
    ["wheelchair", "wheelchairs"],
    ["employed", "employment"],
    ["child", "children"],
    ["person", "people"],
    ["memory", "memories"],
    ["homeless", "homelessness"],
    ["medicine", "medicines"],
    ["pensioner", "pensioners"],
  ])("%s and %s meet", (a, b) => {
    expect(stemEn(a)).toBe(stemEn(b));
  });

  it("keeps short words and tells different words apart", () => {
    expect(stemEn("bus")).toBe("bus");
    expect(stemEn("ATM")).toBe("atm");
    expect(stemEn("deaf")).not.toBe(stemEn("dead"));
    expect(stemEn("blind")).toBe("blind");
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(stemEn("LONELY")).toBe(stemEn("lonely"));
    expect(stemEn("mum's")).toBe(stemEn("mums"));
  });
});

describe("processTermEn", () => {
  it("drops stopwords and single letters, keeps words that carry meaning", () => {
    expect(processTermEn("the")).toBeNull();
    expect(processTermEn("doesn")).toBeNull();
    expect(processTermEn("a")).toBeNull();
    expect(processTermEn("alone")).toBe("alon");
    expect(isStopwordEn("no")).toBe(false);
    expect(isStopwordEn("without")).toBe(false);
  });
});
