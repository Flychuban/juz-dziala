import { describe, expect, it } from "vitest";
import { FIXTURE_CARDS, makeCard } from "./__fixtures__/cards";
import {
  analyzeQuery,
  buildKeywordIndex,
  EXPANSION_WEIGHT,
  keywordSearch,
  LOW_CONFIDENCE_THRESHOLD,
  normalizeScore,
  processTerm,
  SCORE_FOR_FULL_CONFIDENCE,
  stripPlaceholders,
} from "./keywords";
import { SYNONYM_GROUPS } from "./synonyms";

const index = buildKeywordIndex(FIXTURE_CARDS);
const search = (q: string, limit?: number) => keywordSearch(index, FIXTURE_CARDS, q, limit ? { limit } : {});
const topIds = (q: string, n = 3) => search(q).results.slice(0, n).map((r) => r.cardId);

describe("processTerm", () => {
  it("folds and stems", () => {
    expect(processTerm("Samotność")).toBe("samotn");
    expect(processTerm("seniorów")).toBe("senior");
  });

  it("drops stopwords and single characters", () => {
    expect(processTerm("się")).toBeNull();
    expect(processTerm("w")).toBeNull();
    expect(processTerm("g")).toBeNull();
  });
});

describe("buildKeywordIndex", () => {
  it("indexes every card once and remembers the card's own spelling", () => {
    const idx = buildKeywordIndex([...FIXTURE_CARDS, FIXTURE_CARDS[0]!]);
    expect(idx.mini.documentCount).toBe(FIXTURE_CARDS.length);
    expect(idx.cardsById.size).toBe(FIXTURE_CARDS.length);
    expect(idx.surface.get("c001")?.get("osamotn")).toBe("osamotnione");
  });

  it("builds over an empty library", () => {
    expect(buildKeywordIndex([]).mini.documentCount).toBe(0);
  });
});

describe("analyzeQuery", () => {
  it("expands colloquial words into the formal card language", () => {
    const a = analyzeQuery("Mama ma 73 lata, mieszka sama");
    const groups = a.triggeredGroups.map((g) => g.id);
    expect(groups).toContain("seniors");
    expect(groups).toContain("loneliness");
    expect(a.detectedAreas).toContain("seniors");
    const izol = a.terms.find((t) => t.term === processTerm("izolacja"));
    expect(izol).toMatchObject({ direct: false, weight: EXPANSION_WEIGHT });
    expect(izol?.sources).toContain("sama");
  });

  it("reports multi-word triggers as typed", () => {
    const a = analyzeQuery("Tata prawie NIE WYCHODZI Z DOMU");
    expect(a.triggeredGroups.find((g) => g.id === "loneliness")?.matched).toContain("NIE WYCHODZI Z DOMU");
  });

  it("reads ages: 60+ is a senior, a teenager is family, a duration is neither", () => {
    expect(analyzeQuery("ma 73 lata").triggeredGroups.map((g) => g.id)).toContain("seniors");
    expect(analyzeQuery("jest po 70").triggeredGroups.map((g) => g.id)).toContain("seniors");
    const teen = analyzeQuery("16-latek");
    expect(teen.triggeredGroups.map((g) => g.id)).toContain("family");
    expect(teen.terms.some((t) => t.term === processTerm("młodzież"))).toBe(true);
    expect(analyzeQuery("od 5 lat").triggeredGroups).toEqual([]);
    expect(analyzeQuery("5 lat temu").triggeredGroups).toEqual([]);
    expect(analyzeQuery("mam 45 lat").triggeredGroups).toEqual([]);
  });

  it("keeps lęki (fears) apart from leki (medicines) when the text has diacritics", () => {
    const meds = analyzeQuery("Mama często myli leki").triggeredGroups.map((g) => g.id);
    expect(meds).toContain("medication");
    expect(meds).not.toContain("mental_health");
    const fears = analyzeQuery("Córka ma lęki").triggeredGroups.map((g) => g.id);
    expect(fears).toContain("mental_health");
    expect(fears).not.toContain("medication");
  });

  it("treats leki as possibly lęki only when the whole text has no diacritics", () => {
    const groups = analyzeQuery("mama myli leki").triggeredGroups.map((g) => g.id);
    expect(groups).toContain("medication");
    expect(groups).toContain("mental_health");
  });

  it("still matches text typed without diacritics", () => {
    const a = analyzeQuery("zona jezdzi na wozku, jest samotna");
    const groups = a.triggeredGroups.map((g) => g.id);
    expect(groups).toContain("mobility");
    expect(groups).toContain("loneliness");
  });

  it("does not let a short trigger prefix-match a longer word", () => {
    expect(analyzeQuery("samochód").triggeredGroups.map((g) => g.id)).not.toContain("loneliness");
  });

  it("ignores redaction placeholders", () => {
    expect(stripPlaceholders("tel. [telefon], [e-mail], Pani [osoba] [numer konta]")).toBe("tel.  ,  , Pani    ");
    const a = analyzeQuery("PESEL [PESEL], tel. [telefon], [adres]");
    expect(a.triggeredGroups.map((g) => g.id)).not.toContain("digital_exclusion");
    expect(a.terms.map((t) => t.term)).not.toContain(processTerm("telefon"));
  });

  it("returns nothing for stopwords only", () => {
    expect(analyzeQuery("i w na ze się").terms).toEqual([]);
  });

  it("has well-formed synonym data", () => {
    for (const g of SYNONYM_GROUPS) {
      expect(g.triggers.length).toBeGreaterThan(0);
      expect(g.expansions.length).toBeGreaterThan(0);
    }
    expect(new Set(SYNONYM_GROUPS.map((g) => g.id)).size).toBe(SYNONYM_GROUPS.length);
  });
});

describe("normalizeScore", () => {
  it("maps to 0..1 against the calibrated maximum", () => {
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(-3)).toBe(0);
    expect(normalizeScore(Number.NaN)).toBe(0);
    expect(normalizeScore(SCORE_FOR_FULL_CONFIDENCE / 2)).toBeCloseTo(0.5);
    expect(normalizeScore(SCORE_FOR_FULL_CONFIDENCE * 3)).toBe(1);
  });
});

describe("keywordSearch", () => {
  it("answers two-word judge queries sensibly", () => {
    expect(topIds("samotny senior")[0]).toBe("c001");
    expect(topIds("depresja nastolatek")[0]).toBe("c002");
    expect(topIds("wózek autobus")).toEqual(expect.arrayContaining(["c003", "c004"]));
    expect(topIds("niewidomy telefon")[0]).toBe("c004");
  });

  it("bridges colloquial stories to formal cards", () => {
    expect(topIds("Mama ma 73 lata, owdowiała, mieszka sama, prawie nie wychodzi, myli leki.")).toEqual(
      expect.arrayContaining(["c001", "c006"]),
    );
    expect(topIds("sąsiad jest bezdomny i nie ma gdzie się umyć")[0]).toBe("c005");
    expect(topIds("Ukrainka z dziećmi, nie zna polskiego")[0]).toBe("c007");
  });

  it("returns the user's words as typed and the card's words as spelled", () => {
    const hit = search("Samotny SENIOR").results[0]!;
    expect(hit.matchedUserTerms).toEqual(expect.arrayContaining(["Samotny", "SENIOR"]));
    expect(hit.matchedCardTerms).toEqual(expect.arrayContaining(["seniorów", "osamotnione"]));
    expect(hit.areas).toEqual(["seniors"]);
  });

  it("credits a synonym hit to the word that triggered it", () => {
    const hit = search("babcia").results.find((r) => r.cardId === "c001")!;
    expect(hit.matchedUserTerms).toEqual(["babcia"]);
  });

  it("scores in 0..1 and sorts by score", () => {
    const { results } = search("osoby starsze samotność izolacja");
    expect(results.length).toBeGreaterThan(1);
    for (const r of results) {
      expect(r.normScore).toBeGreaterThanOrEqual(0);
      expect(r.normScore).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < results.length; i++) expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
  });

  it("is low-confidence for a problem the library does not cover", () => {
    const r = search("Na naszej ulicy jest dziura w jezdni, do kogo to zgłosić?");
    expect(r.isLowConfidence).toBe(true);
    expect((r.results[0]?.normScore ?? 0) < LOW_CONFIDENCE_THRESHOLD).toBe(true);
  });

  it("is confident for a clear match", () => {
    expect(search("samotny senior na wsi").isLowConfidence).toBe(false);
  });

  it("handles an empty or stopword-only query", () => {
    expect(search("")).toEqual({ results: [], detectedAreas: [], isLowConfidence: true });
    expect(search("i w na").results).toEqual([]);
  });

  it("respects the limit", () => {
    expect(search("osoby", 2).results.length).toBeLessThanOrEqual(2);
  });

  it("reports detected areas from the query", () => {
    expect(search("bezdomny Ukrainiec").detectedAreas).toEqual(expect.arrayContaining(["homelessness", "migrants"]));
  });

  it("answers in well under 50 ms over a library of 115 cards", () => {
    const many = Array.from({ length: 115 }, (_, i) => {
      const base = FIXTURE_CARDS[i % FIXTURE_CARDS.length]!;
      return makeCard({
        id: `m${String(i).padStart(3, "0")}`,
        slug: `${base.slug}-${i}`,
        title: `${base.title} ${i}`,
        sections: { ...base.sections, doesItWork: "Test wykazał przydatność rozwiązania. ".repeat(20) },
        mapaAreas: base.mapaAreas,
      });
    });
    const idx = buildKeywordIndex(many);
    const queries = [
      "samotny senior",
      "depresja nastolatek",
      "wózek autobus",
      "Mama ma 73 lata, owdowiała, mieszka sama pod Limanową, prawie nie wychodzi, myli leki.",
      "Sąsiad od zimy jest bezdomny, ma cukrzycę, bierze insulinę i nie ma gdzie się umyć ani przebrać.",
    ];
    keywordSearch(idx, many, "rozgrzewka");
    let worst = 0;
    for (const q of queries) {
      const t0 = performance.now();
      keywordSearch(idx, many, q);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(worst).toBeLessThan(50);
  });
});
