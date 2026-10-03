import { describe, expect, it } from "vitest";
import { FIXTURE_CARDS } from "./__fixtures__/cards";
import {
  aiMatchOutputSchema,
  clip,
  decideAbstain,
  filterUserTerms,
  finalizeMatches,
  sanitizeAreas,
  type AiMatchOutput,
  type FinalizeContext,
} from "./verify";

const cardsById = new Map(FIXTURE_CARDS.map((c) => [c.id, c]));
const userText = "Mama ma 73 lata, owdowiała, mieszka sama pod Limanową, prawie nie wychodzi, myli leki.";

const ctx = (over: Partial<FinalizeContext> = {}): FinalizeContext => ({
  userText,
  cardsById,
  allowedCardIds: new Set(["c001", "c006", "c003"]),
  keyword: { isLowConfidence: false },
  ...over,
});

const match = (innovationId: string, evidenceSentenceIds: string[], extra: Partial<AiMatchOutput["matches"][number]> = {}) => ({
  innovationId,
  why: "Pasuje do sytuacji.",
  userTerms: [],
  evidenceSentenceIds,
  firstStep: "Zadzwoń do ośrodka pomocy społecznej.",
  ...extra,
});

const ai = (matches: AiMatchOutput["matches"], abstain = false): AiMatchOutput => ({ matches, abstain, areas: ["seniors"] });

describe("clip", () => {
  it("leaves short text alone but trims and collapses spaces", () => {
    expect(clip("  krótki   tekst ", 300)).toBe("krótki tekst");
  });

  it("cuts long text to the limit on a word boundary with an ellipsis", () => {
    const long = "słowo ".repeat(100);
    const out = clip(long, 300);
    expect(Array.from(out).length).toBeLessThanOrEqual(300);
    expect(out.endsWith("słowo…")).toBe(true);
  });

  it("cuts a single overlong word hard", () => {
    const out = clip("a".repeat(500), 200);
    expect(out.length).toBe(200);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("filterUserTerms", () => {
  it("keeps terms present in the text and returns them as written", () => {
    expect(filterUserTerms(["mieszka sama", "nie wychodzi"], userText)).toEqual(["mieszka sama", "nie wychodzi"]);
  });

  it("is diacritic- and case-insensitive and tolerates a different ending", () => {
    expect(filterUserTerms(["OWDOWIALA", "samotność", "limanowa"], "Owdowiała, samotna, pod Limanową")).toEqual([
      "Owdowiała",
      "samotna",
      "Limanową",
    ]);
  });

  it("drops terms the resident never wrote, and phrases whose words are not in a row", () => {
    expect(filterUserTerms(["depresja", "demencja", "mama leki"], userText)).toEqual([]);
  });

  it("does not let a short term prefix-match a long word", () => {
    expect(filterUserTerms(["sam"], "samochód się zepsuł")).toEqual([]);
  });

  it("dedupes and caps at six", () => {
    const text = "jeden dwa trzy cztery pięć sześć siedem osiem";
    const terms = ["jeden", "JEDEN", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem"];
    expect(filterUserTerms(terms, text)).toEqual(["jeden", "dwa", "trzy", "cztery", "pięć", "sześć"]);
  });
});

describe("decideAbstain", () => {
  it("abstains only when the AI failed and the keyword match is weak", () => {
    expect(decideAbstain(true, [], { isLowConfidence: true })).toEqual({ abstain: true, fallbackToKeyword: false });
    expect(decideAbstain(false, [], { isLowConfidence: true })).toEqual({ abstain: true, fallbackToKeyword: false });
  });

  it("falls back to keyword results when the AI failed but keywords are confident", () => {
    expect(decideAbstain(true, [], { isLowConfidence: false })).toEqual({ abstain: false, fallbackToKeyword: true });
    expect(decideAbstain(false, [], { isLowConfidence: false })).toEqual({ abstain: false, fallbackToKeyword: true });
  });

  it("uses the AI matches when some survived", () => {
    expect(decideAbstain(false, [{}], { isLowConfidence: true })).toEqual({ abstain: false, fallbackToKeyword: false });
  });
});

describe("finalizeMatches", () => {
  it("resolves evidence ids to our own sentence text", () => {
    const r = finalizeMatches(ai([match("c001", ["c001.s3", "c001.s4"])]), ctx());
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.card.id).toBe("c001");
    expect(r.matches[0]!.evidence).toEqual([
      { id: "c001.s3", text: "Osoby starsze czują się osamotnione i odtrącone." },
      { id: "c001.s4", text: "Doświadczają izolacji społecznej." },
    ]);
    expect(r.abstained).toBe(false);
    expect(r.fallbackToKeyword).toBe(false);
  });

  it("drops a card that was not offered to the model", () => {
    const r = finalizeMatches(ai([match("c005", ["c005.s1"])]), ctx());
    expect(r.matches).toEqual([]);
    expect(r.dropped).toEqual([{ innovationId: "c005", reason: "not_allowed" }]);
  });

  it("drops an allowed id that is not a known card", () => {
    const r = finalizeMatches(ai([match("c999", ["c999.s1"])]), ctx({ allowedCardIds: new Set(["c999"]) }));
    expect(r.dropped).toEqual([{ innovationId: "c999", reason: "unknown_card" }]);
  });

  it("ignores evidence ids from another card or that do not exist, and drops a match left with none", () => {
    const r = finalizeMatches(ai([match("c001", ["c006.s1", "c001.s99", "nonsense"])]), ctx());
    expect(r.matches).toEqual([]);
    expect(r.dropped).toEqual([{ innovationId: "c001", reason: "no_evidence" }]);
  });

  it("keeps a match with at least one valid id and discards the invalid ones", () => {
    const r = finalizeMatches(ai([match("c001", ["c006.s1", "c001.s1"])]), ctx());
    expect(r.matches[0]!.evidence.map((e) => e.id)).toEqual(["c001.s1"]);
  });

  it("dedupes matches and evidence ids", () => {
    const r = finalizeMatches(ai([match("c001", ["c001.s1", "c001.s1"]), match("c001", ["c001.s2"])]), ctx());
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.evidence).toHaveLength(1);
    expect(r.dropped).toEqual([{ innovationId: "c001", reason: "duplicate" }]);
  });

  it("caps at three matches and three evidence sentences each", () => {
    const allowed = new Set(FIXTURE_CARDS.map((c) => c.id));
    const r = finalizeMatches(
      ai(["c001", "c002", "c003", "c004"].map((id) => match(id, [1, 2, 3, 4].map((n) => `${id}.s${n}`)))),
      ctx({ allowedCardIds: allowed }),
    );
    expect(r.matches.map((m) => m.card.id)).toEqual(["c001", "c002", "c003"]);
    for (const m of r.matches) expect(m.evidence.length).toBeLessThanOrEqual(3);
    expect(r.dropped).toEqual([{ innovationId: "c004", reason: "over_cap" }]);
  });

  it("keeps only user terms that are really in the text", () => {
    const r = finalizeMatches(
      ai([match("c001", ["c001.s1"], { userTerms: ["mieszka sama", "samotność", "demencja", "nie wychodzi"] })]),
      ctx(),
    );
    // "samotność" is not a word the resident wrote ("sama" is a different word), so it goes.
    expect(r.matches[0]!.userTerms).toEqual(["mieszka sama", "nie wychodzi"]);
  });

  it("clips why to 300 and firstStep to 200 characters", () => {
    const r = finalizeMatches(
      ai([match("c001", ["c001.s1"], { why: "uzasadnienie ".repeat(60), firstStep: "krok ".repeat(80) })]),
      ctx(),
    );
    expect(Array.from(r.matches[0]!.why).length).toBeLessThanOrEqual(300);
    expect(Array.from(r.matches[0]!.firstStep).length).toBeLessThanOrEqual(200);
  });

  it("when the AI abstains, shows no AI matches and falls back to confident keywords", () => {
    const r = finalizeMatches(ai([match("c001", ["c001.s1"])], true), ctx());
    expect(r.matches).toEqual([]);
    expect(r.abstained).toBe(false);
    expect(r.fallbackToKeyword).toBe(true);
    expect(r.dropped).toEqual([{ innovationId: "c001", reason: "ai_abstained" }]);
  });

  it("abstains when nothing survived and keywords are weak", () => {
    const r = finalizeMatches(ai([match("c005", ["c005.s1"])]), ctx({ keyword: { isLowConfidence: true } }));
    expect(r.abstained).toBe(true);
    expect(r.fallbackToKeyword).toBe(false);
  });
});

describe("aiMatchOutputSchema", () => {
  it("parses a well-formed model answer and rejects a malformed one", () => {
    expect(aiMatchOutputSchema.safeParse(ai([match("c001", ["c001.s1"])])).success).toBe(true);
    expect(aiMatchOutputSchema.safeParse({ matches: [{ innovationId: 1 }], abstain: "no", areas: [] }).success).toBe(false);
    expect(aiMatchOutputSchema.safeParse({ matches: [], abstain: false, areas: ["nonsense"] }).success).toBe(false);
  });
});

describe("sanitizeAreas", () => {
  it("keeps valid areas once each and drops the rest", () => {
    expect(sanitizeAreas(["seniors", "bogus", "seniors", 3, "health"])).toEqual(["seniors", "health"]);
  });
});
