import { describe, expect, it } from "vitest";

import { FIXTURE_CARDS } from "~/server/domain/__fixtures__/cards";
import {
  buildCatalog,
  compactTerms,
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
    const row = { ...card, capturedAt: new Date("2026-10-03T12:00:00Z"), sha256: null };
    const out = toLibraryCard(row);
    expect(out.capturedAt).toBe("2026-10-03T12:00:00.000Z");
    expect(out.sha256).toBe("");
    expect(out.sentences).toBe(card.sentences);
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
