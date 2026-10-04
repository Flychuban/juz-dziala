import { describe, expect, it } from "vitest";

import { FIXTURE_CARDS } from "~/server/domain/__fixtures__/cards";
import {
  buildCatalog,
  cardSourceSha,
  cardText,
  compactTerms,
  currentEnglish,
  decide,
  decisionSlugs,
  keywordWhy,
  meaningfulTerms,
  NO_CANDIDATES,
  pickEvidence,
  runAreas,
  runKeyword,
  SHOWN,
  toLibraryCard,
  verifyAi,
  withEnglish,
  type StoredCardEn,
  type StoredKeyword,
} from "./core";

const catalog = buildCatalog(FIXTURE_CARDS);
const query = "Mama ma 73 lata, mieszka sama na wsi, prawie nie wychodzi i myli leki.";
const keyword = runKeyword(catalog, query);

describe("buildCatalog", () => {
  it("indexes cards by id and slug and builds the compact index", () => {
    expect(catalog.cards.map((c) => c.id)).toEqual([...FIXTURE_CARDS].map((c) => c.id).sort());
    expect(catalog.byId.get("c004")?.slug).toBe("aplikacja-dla-niewidomych");
    expect(catalog.bySlug.get("organizer-na-leki")?.id).toBe("c006");
    expect(catalog.compactIndex).toContain("c007 | Gra integracyjna dla cudzoziemców");
  });
});

describe("toLibraryCard", () => {
  it("turns a DB row into a LibraryCard (date to ISO, null sha to empty)", () => {
    const card = FIXTURE_CARDS[0]!;
    const row = { ...card, capturedAt: new Date("2026-10-03T12:00:00Z"), sha256: null, en: null };
    const out = toLibraryCard(row);
    expect(out.capturedAt).toBe("2026-10-03T12:00:00.000Z");
    expect(out.sha256).toBe("");
    expect(out.sentences).toBe(card.sentences);
    expect(out.en).toBeNull();
  });

  it("keeps a current English translation and drops a stale one", () => {
    const card = FIXTURE_CARDS[0]!;
    const stored: StoredCardEn = { ...card.en!, sourceSha: cardSourceSha(card) };
    expect(toLibraryCard({ ...card, sha256: null, en: stored }).en?.title).toBe("Mobile support for older people");
    // Staff edited the Polish card after the translation was made: show Polish.
    const edited = { ...card, title: "Nowy tytuł", sha256: null, en: stored };
    expect(toLibraryCard(edited).en).toBeNull();
  });
});

describe("currentEnglish", () => {
  const card = FIXTURE_CARDS[0]!;
  const stored: StoredCardEn = { ...card.en!, sourceSha: cardSourceSha(card) };

  it("needs every sentence id translated", () => {
    expect(currentEnglish(card, stored)).not.toBeNull();
    const missing = { ...stored, sentences: { ...stored.sentences, "c001.s3": "" } };
    expect(currentEnglish(card, missing)).toBeNull();
    expect(currentEnglish(card, null)).toBeNull();
  });

  it("hashes the sections in their canonical order, whatever order a jsonb column returns", () => {
    const reordered = { ...card, sections: Object.fromEntries(Object.entries(card.sections).reverse()) as typeof card.sections };
    expect(cardSourceSha(reordered)).toBe(cardSourceSha(card));
  });

  it("attaches data/library.en.json by id (eval)", () => {
    const [withEn] = withEnglish([{ ...card, en: null }], { c001: stored });
    expect(withEn?.en?.title).toBe("Mobile support for older people");
  });
});

describe("cardText", () => {
  it("is English on the English page when a translation exists, else Polish", () => {
    const card = catalog.byId.get("c001")!;
    expect(cardText(card, "en")).toMatchObject({ lang: "en", title: "Mobile support for older people" });
    expect(cardText(card, "en").sentenceEn("c001.s3")).toBe("Older people feel lonely and rejected.");
    expect(cardText(card, "pl")).toMatchObject({ lang: "pl", title: "Mobilne wsparcie seniorów" });
    expect(cardText(catalog.byId.get("c003")!, "en")).toMatchObject({ lang: "pl", title: "Elektryczny moduł do wózka" });
  });
});

describe("compactTerms", () => {
  it("drops repeats and terms contained in a longer phrase", () => {
    expect(compactTerms(["leki", "myli leki", "Mama", "MAMA", "nie wychodzi", "prawie nie wychodzi"])).toEqual([
      "myli leki",
      "Mama",
      "prawie nie wychodzi",
    ]);
  });

  it("does not drop a word that only shares letters with another", () => {
    expect(compactTerms(["sam", "samotny"])).toEqual(["sam", "samotny"]);
  });
});

describe("meaningfulTerms", () => {
  it("drops general single words but keeps phrases, ages and specific words", () => {
    expect(meaningfulTerms(["Osoba", "niewidoma", "problem", "mieszka sama", "73 lata"])).toEqual([
      "niewidoma",
      "mieszka sama",
      "73 lata",
    ]);
  });

  it("keeps everything when only general words matched", () => {
    expect(meaningfulTerms(["osoba", "problem"])).toEqual(["osoba", "problem"]);
  });
});

describe("runKeyword", () => {
  it("stores hits with compacted user terms and the detected areas", () => {
    expect(keyword.v).toBe(1);
    expect(keyword.hits.map((h) => h.cardId)).toEqual(expect.arrayContaining(["c001", "c006"]));
    expect(keyword.detectedAreas).toContain("seniors");
    expect(keyword.userTerms).toContain("myli leki");
    expect(keyword.userTerms).not.toContain("leki");
    expect(keyword.isLowConfidence).toBe(false);
  });
});

describe("runKeyword in English", () => {
  it("finds cards through their English translation", () => {
    const en = runKeyword(catalog, "My mum is 78, lives alone and mixes up her pills", "en");
    expect(en.hits.map((h) => h.cardId)).toEqual(expect.arrayContaining(["c001", "c006"]));
    expect(en.isLowConfidence).toBe(false);
    expect(en.detectedAreas).toContain("seniors");
    expect(en.hits.find((h) => h.cardId === "c006")?.lang).toBe("en");
    expect(en.userTerms.some((t) => /pills|alone/u.test(t))).toBe(true);
  });

  it("still understands Polish typed on the English site (best score per card)", () => {
    const pl = runKeyword(catalog, query, "pl");
    const both = runKeyword(catalog, query, "en");
    expect(both.hits[0]?.cardId).toBe(pl.hits[0]?.cardId);
    expect(both.hits[0]!.normScore).toBeGreaterThanOrEqual(pl.hits[0]!.normScore);
    expect(both.isLowConfidence).toBe(false);
  });

  it("a Polish search ignores the English index", () => {
    expect(runKeyword(catalog, "lonely older people").hits.every((h) => h.lang === undefined)).toBe(true);
  });

  it("stays low-confidence on text the library does not cover", () => {
    expect(runKeyword(catalog, "There is a huge pothole in our road", "en").isLowConfidence).toBe(true);
  });
});

describe("runAreas", () => {
  it("uses the query's areas, else the confident top card's", () => {
    expect(runAreas(catalog, keyword)).toEqual(keyword.detectedAreas);
    const noAreas: StoredKeyword = { ...keyword, detectedAreas: [] };
    expect(runAreas(catalog, noAreas)).toEqual(catalog.byId.get(keyword.hits[0]!.cardId)!.mapaAreas);
    expect(runAreas(catalog, { ...noAreas, isLowConfidence: true })).toEqual([]);
  });
});

describe("verifyAi", () => {
  const ctx = { redactedQuery: query, catalog, keyword };

  it("keeps a verified match with our own sentence text", () => {
    const stored = verifyAi(
      {
        ok: true,
        latencyMs: 1200,
        costUsd: 0.04,
        data: {
          abstain: false,
          areas: ["seniors", "bogus" as never],
          matches: [
            {
              innovationId: "c001",
              why: "Pasuje, bo mama mieszka sama.",
              userTerms: ["mieszka sama", "nie ma tego"],
              evidenceSentenceIds: ["c001.s3", "c006.s1"],
              firstStep: "Zapytaj w ośrodku pomocy społecznej.",
            },
          ],
        },
      },
      ctx,
    );
    expect(stored.ok).toBe(true);
    expect(stored.matches).toEqual([
      {
        cardId: "c001",
        why: "Pasuje, bo mama mieszka sama.",
        userTerms: ["mieszka sama"],
        evidence: [{ id: "c001.s3", text: "Osoby starsze czują się osamotnione i odtrącone." }],
        firstStep: "Zapytaj w ośrodku pomocy społecznej.",
      },
    ]);
    expect(stored.areas).toEqual(["seniors"]);
    expect(stored.allowedCardIds).toEqual(keyword.hits.map((h) => h.cardId));
    expect(stored.costUsd).toBe(0.04);
  });

  it("drops a card the keyword step did not offer", () => {
    const weak = runKeyword(catalog, "samotny senior");
    expect(weak.hits.map((h) => h.cardId)).not.toContain("c007");
    const stored = verifyAi(
      {
        ok: true,
        latencyMs: 1,
        costUsd: 0,
        data: {
          abstain: false,
          areas: [],
          matches: [{ innovationId: "c007", why: "x", userTerms: [], evidenceSentenceIds: ["c007.s1"], firstStep: "x" }],
        },
      },
      { redactedQuery: "samotny senior", catalog, keyword: weak },
    );
    expect(stored.matches).toEqual([]);
    expect(stored.dropped).toEqual([{ innovationId: "c007", reason: "not_allowed" }]);
    expect(stored.fallbackToKeyword).toBe(true);
  });

  it("records a failed call and falls back to keywords when they are confident", () => {
    const stored = verifyAi({ ok: false, reason: "timeout", latencyMs: 30000 }, ctx);
    expect(stored).toMatchObject({ ok: false, reason: "timeout", abstained: false, fallbackToKeyword: true, matches: [] });
  });

  it("never stores a failed call as an abstention, even when the keywords are weak", () => {
    const weak = runKeyword(catalog, "dziura w jezdni");
    const stored = verifyAi({ ok: false, reason: "error", latencyMs: 10 }, { redactedQuery: "dziura w jezdni", catalog, keyword: weak });
    expect(stored).toMatchObject({ ok: false, abstained: false, fallbackToKeyword: false });
  });

  it("abstains with no candidates and weak keywords", () => {
    const empty = runKeyword(catalog, "dziura w jezdni");
    expect(empty.isLowConfidence).toBe(true);
    const stored = verifyAi(NO_CANDIDATES, { redactedQuery: "dziura w jezdni", catalog, keyword: empty });
    expect(stored.abstained).toBe(true);
  });
});

describe("pickEvidence", () => {
  it("prefers the sentence with the most matched words, from the problem section", () => {
    const card = catalog.byId.get("c001")!;
    expect(pickEvidence(card, ["osamotnione", "starsze"])?.id).toBe("c001.s3");
  });

  it("looks for English card words in the English sentences, and returns the Polish id", () => {
    const card = catalog.byId.get("c001")!;
    expect(pickEvidence(card, ["lonely", "isolation"], "en")?.id).toBe("c001.s3");
  });

  it("falls back to the first problem sentence and never quotes the authors", () => {
    const card = catalog.byId.get("c001")!;
    expect(pickEvidence(card, [])?.section).toBe("problems");
  });
});

describe("keywordWhy", () => {
  it("quotes only the resident's words", () => {
    expect(keywordWhy(["mieszka sama", "myli leki"])).toBe("Pasuje, bo napisałaś/eś: „mieszka sama”, „myli leki”.");
    expect(keywordWhy([])).toBe("Pasuje do słów z Twojego opisu.");
  });

  it("speaks English on the English page", () => {
    expect(keywordWhy(["lives alone"], "en")).toBe("This fits because you wrote: “lives alone”.");
    expect(keywordWhy([], "en")).toBe("This matches words from your description.");
  });
});

describe("decide", () => {
  const verified = verifyAi(
    {
      ok: true,
      latencyMs: 1,
      costUsd: 0,
      data: {
        abstain: false,
        areas: ["health"],
        matches: [{ innovationId: "c006", why: "Pasuje.", userTerms: ["myli leki"], evidenceSentenceIds: ["c006.s2"], firstStep: "Krok." }],
      },
    },
    { redactedQuery: query, catalog, keyword },
  );

  it("shows preliminary keyword results while the AI is pending", () => {
    const d = decide(catalog, keyword, null, true, ["seniors"]);
    expect(d.stage).toBe("preliminary");
    expect(d.results.length).toBeLessThanOrEqual(SHOWN);
    expect(d.results.every((r) => !r.verified && r.evidence.length === 1)).toBe(true);
  });

  it("hides a weak keyword list while the AI is pending", () => {
    const weak = runKeyword(catalog, "dziura w jezdni");
    expect(decide(catalog, weak, null, true, []).results).toEqual([]);
  });

  it("shows verified matches with their sections and the AI's areas", () => {
    const d = decide(catalog, keyword, verified, true, ["seniors"]);
    expect(d.stage).toBe("verified");
    expect(d.areas).toEqual(["health"]);
    expect(d.results[0]).toMatchObject({ cardId: "c006", verified: true, firstStep: "Krok." });
    expect(d.results[0]!.evidence[0]!.section).toBe("problems");
    expect(decisionSlugs(catalog, d)).toEqual(["organizer-na-leki"]);
  });

  it("abstains when the AI result abstained", () => {
    expect(decide(catalog, keyword, { ...verified, abstained: true, matches: [] }, true, []).stage).toBe("abstained");
  });

  it("after a failed AI call shows no weak keyword list and does not abstain", () => {
    const weak = runKeyword(catalog, "dziura w jezdni");
    const failed = verifyAi({ ok: false, reason: "timeout", latencyMs: 1 }, { redactedQuery: "dziura w jezdni", catalog, keyword: weak });
    expect(decide(catalog, weak, failed, true, [])).toMatchObject({ stage: "keyword", note: "ai_error", results: [] });
  });

  it("writes the keyword sentence in the page's language", () => {
    const d = decide(catalog, keyword, null, false, [], "en");
    expect(d.results[0]?.why.startsWith("This fits because you wrote:")).toBe(true);
  });

  it("falls back to final keyword results with a note when the AI failed or found nothing", () => {
    const failed = decide(catalog, keyword, { ...verified, ok: false, matches: [] }, true, []);
    expect(failed).toMatchObject({ stage: "keyword", note: "ai_error" });
    const none = decide(catalog, keyword, { ...verified, matches: [], fallbackToKeyword: true }, true, []);
    expect(none).toMatchObject({ stage: "keyword", note: "ai_no_better" });
    expect(none.results.length).toBeGreaterThan(0);
  });

  it("without an API key: keyword results are final, a weak list is an abstention", () => {
    expect(decide(catalog, keyword, null, false, [])).toMatchObject({ stage: "keyword", note: "ai_unavailable" });
    const weak = runKeyword(catalog, "dziura w jezdni");
    expect(decide(catalog, weak, null, false, [])).toMatchObject({ stage: "abstained", note: "ai_unavailable" });
  });
});
