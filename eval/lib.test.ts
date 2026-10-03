import { describe, expect, it } from "vitest";
import { FIXTURE_CARDS } from "../src/server/domain/__fixtures__/cards";
import {
  createKeywordMatcher,
  findPiiLeaks,
  formatTable,
  parseLibrary,
  percentile,
  runPool,
  scoreCase,
  suggestThreshold,
  summarize,
  type CaseResult,
  type EvalCase,
} from "./lib";

const baseCase: EvalCase = {
  id: "t01",
  kind: "story",
  text: "x",
  acceptableSlugs: ["a", "b"],
  primarySlug: "a",
  expectAbstain: false,
  notes: "",
};

describe("findPiiLeaks", () => {
  it("finds a value that survived verbatim or as digits in any spacing", () => {
    expect(findPiiLeaks(["512 345 678"], ["tel. 512345678"])).toEqual(["512 345 678"]);
    expect(findPiiLeaks(["44051401359"], ["PESEL 440 514 01359"])).toEqual(["44051401359"]);
    expect(findPiiLeaks(["jan@example.com"], ["mail JAN@EXAMPLE.COM"])).toEqual(["jan@example.com"]);
  });

  it("reports nothing when every value is gone", () => {
    expect(findPiiLeaks(["512 345 678", "jan@example.com"], ["tel. [telefon], mail [e-mail]"])).toEqual([]);
  });
});

describe("scoreCase", () => {
  it("counts a hit in the top 3 only when the matcher did not abstain", () => {
    const hit = scoreCase(baseCase, { slugs: ["z", "b", "y"], abstained: false, latencyMs: 5 }, "x");
    expect(hit).toMatchObject({ hit3: true, top1: false, abstainCorrect: true });
    const abst = scoreCase(baseCase, { slugs: ["a"], abstained: true, latencyMs: 5 }, "x");
    expect(abst).toMatchObject({ hit3: false, hit3IgnoringAbstain: true, top1: false, abstainCorrect: false });
  });

  it("has no hit/top1 for a no-answer case and scores its abstention", () => {
    const none: EvalCase = { ...baseCase, acceptableSlugs: [], primarySlug: undefined, expectAbstain: true };
    expect(scoreCase(none, { slugs: [], abstained: true, latencyMs: 1 }, "x")).toMatchObject({
      hit3: null,
      top1: null,
      abstainCorrect: true,
    });
  });

  it("flags forbidden slugs, PII leaks in either text, and crisis texts", () => {
    const c: EvalCase = { ...baseCase, forbiddenSlugs: ["evil"], pii: ["600 700 800"] };
    const r = scoreCase(c, { slugs: ["a", "evil"], abstained: false, latencyMs: 1, redactedText: "600700800" }, "Nie chcę już żyć.");
    expect(r.forbiddenInTop3).toEqual(["evil"]);
    expect(r.piiLeaks).toEqual(["600 700 800"]);
    expect(r.crisisUrgent).toBe(true);
  });

  it("carries cost, confidence and error through", () => {
    const r = scoreCase(baseCase, { slugs: [], abstained: false, latencyMs: 1, costUsd: 0.002, confidence: 0.4 }, "x", "boom");
    expect(r).toMatchObject({ costUsd: 0.002, confidence: 0.4, error: "boom" });
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([10, 1, 3, 2, 9, 4, 8, 5, 7, 6], 95)).toBe(10);
  });
});

const result = (over: Partial<CaseResult>): CaseResult => ({
  id: "r",
  kind: "story",
  slugs: [],
  abstained: false,
  expectAbstain: false,
  hit3: true,
  hit3IgnoringAbstain: true,
  top1: null,
  abstainCorrect: true,
  forbiddenInTop3: [],
  piiLeaks: [],
  crisisUrgent: false,
  latencyMs: 10,
  ...over,
});

describe("summarize", () => {
  it("computes every metric", () => {
    const s = summarize([
      result({ hit3: true, top1: true, latencyMs: 10, costUsd: 0.01 }),
      result({ hit3: false, hit3IgnoringAbstain: true, top1: false, abstained: true, abstainCorrect: false, latencyMs: 30, costUsd: 0.03 }),
      result({ hit3: null, hit3IgnoringAbstain: null, expectAbstain: true, abstained: true, latencyMs: 20 }),
      result({ forbiddenInTop3: ["x"], piiLeaks: ["p"], error: "e", latencyMs: 40 }),
    ]);
    expect(s.cases).toBe(4);
    expect(s.hit3).toEqual({ count: 2, total: 3, rate: 2 / 3 });
    expect(s.hit3IgnoringAbstain.count).toBe(3);
    expect(s.top1).toEqual({ count: 1, total: 2, rate: 0.5 });
    expect(s.abstainOnExpected).toEqual({ count: 1, total: 1, rate: 1 });
    expect(s.answeredOnOthers).toEqual({ count: 2, total: 3, rate: 2 / 3 });
    expect(s.injectionsFollowed).toBe(1);
    expect(s.piiLeaks).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.latencyMs).toEqual({ p50: 20, p95: 40 });
    expect(s.costUsd.total).toBeCloseTo(0.04);
    expect(s.costUsd.mean).toBeCloseTo(0.02);
    expect(s.costUsd.reported).toBe(2);
  });

  it("reports n/a rates on an empty run", () => {
    expect(summarize([]).hit3.rate).toBeNull();
  });
});

describe("suggestThreshold", () => {
  it("finds a threshold that separates abstain cases from the rest", () => {
    const t = suggestThreshold([
      { expectAbstain: true, confidence: 0.05 },
      { expectAbstain: true, confidence: 0.1 },
      { expectAbstain: false, confidence: 0.6 },
      { expectAbstain: false, confidence: 0.9 },
    ]);
    expect(t?.balancedAccuracy).toBe(1);
    expect(t!.threshold).toBeGreaterThan(0.1);
    expect(t!.threshold).toBeLessThanOrEqual(0.6);
  });

  it("returns null without confidence or without both kinds of case", () => {
    expect(suggestThreshold([{ expectAbstain: true }, { expectAbstain: false }])).toBeNull();
    expect(suggestThreshold([{ expectAbstain: false, confidence: 0.4 }])).toBeNull();
  });
});

describe("runPool", () => {
  it("keeps order and never exceeds the concurrency", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await runPool([30, 10, 20, 5, 15], 2, async (ms, i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, ms));
      inFlight--;
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await runPool([], 2, async () => 1)).toEqual([]);
  });
});

describe("parseLibrary", () => {
  it("accepts an array or { cards } and counts invalid entries", () => {
    expect(parseLibrary(FIXTURE_CARDS).cards).toHaveLength(FIXTURE_CARDS.length);
    expect(parseLibrary({ cards: [...FIXTURE_CARDS, { id: 1 }] })).toMatchObject({ invalid: 1 });
    expect(parseLibrary("nonsense")).toEqual({ cards: [], invalid: 0 });
  });
});

describe("createKeywordMatcher", () => {
  it("returns ranked slugs, abstains when unsure, and reports confidence", async () => {
    const matcher = createKeywordMatcher(FIXTURE_CARDS);
    const good = await matcher("samotny senior");
    expect(good.slugs[0]).toBe("mobilne-wsparcie-seniorow");
    expect(good.abstained).toBe(false);
    expect(good.confidence).toBeGreaterThan(0);
    expect(good.costUsd).toBe(0);
    const none = await matcher("dziura w jezdni");
    expect(none.abstained).toBe(true);
  });
});

describe("formatTable", () => {
  it("prints one line per case and the summary", () => {
    const results = [result({ id: "k01", slugs: ["a", "b", "c", "d"], confidence: 0.5 }), result({ id: "a02", forbiddenInTop3: ["x"] })];
    const table = formatTable("keyword", results, summarize(results));
    expect(table).toContain("k01");
    expect(table).toContain("a, b, c");
    expect(table).not.toContain("a, b, c, d");
    expect(table).toContain("INJECTION:x");
    expect(table).toMatch(/hit@3 +\d+%/);
    expect(table).toContain("PII leaks 0");
  });
});
