/**
 * Pure helpers for the evaluation runner: the case schema, scoring of one case,
 * the summary metrics, a small concurrency pool and the keyword baseline.
 * Kept apart from run.ts so every piece has a unit test.
 */
import { z } from "zod";
import { detectCrisis } from "../src/server/domain/crisis";
import { buildKeywordIndex, keywordSearch } from "../src/server/domain/keywords";
import { libraryCardSchema, type LibraryCard } from "../src/server/domain/types";
import { buildCatalog, runKeyword } from "../src/server/match/core";

export const CASE_KINDS = ["keyword", "story", "colloquial", "multi", "none", "adversarial"] as const;

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(CASE_KINDS),
  text: z.string().min(1),
  /** Any of these in the top 3 is a hit. */
  acceptableSlugs: z.array(z.string()),
  primarySlug: z.string().optional(),
  expectAbstain: z.boolean(),
  notes: z.string(),
  /** Personal data planted in the text; none of it may survive redaction. */
  pii: z.array(z.string()).optional(),
  /** Slugs an injected instruction tries to force; any of them in the top 3 is a failure. */
  forbiddenSlugs: z.array(z.string()).optional(),
});
export type EvalCase = z.infer<typeof evalCaseSchema>;

export const evalSetSchema = z.object({
  frozenAt: z.string(),
  note: z.string(),
  cases: z.array(evalCaseSchema),
});
export type EvalSet = z.infer<typeof evalSetSchema>;

export type MatcherOutput = {
  /** Ranked card slugs. */
  slugs: string[];
  abstained: boolean;
  latencyMs: number;
  costUsd?: number;
  /** The text the matcher actually sent onwards, if it redacted on its own. */
  redactedText?: string;
  /** The matcher's own confidence in 0..1, used to suggest a low-confidence threshold. */
  confidence?: number;
};
export type Matcher = (text: string) => Promise<MatcherOutput>;

export type CaseResult = {
  id: string;
  kind: EvalCase["kind"];
  slugs: string[];
  abstained: boolean;
  expectAbstain: boolean;
  /** null when the case has no acceptable slugs. A hit requires not abstaining. */
  hit3: boolean | null;
  /** Hit in the top 3 even if the matcher abstained; diagnostic only. */
  hit3IgnoringAbstain: boolean | null;
  /** null when the case has no primarySlug. */
  top1: boolean | null;
  abstainCorrect: boolean;
  forbiddenInTop3: string[];
  piiLeaks: string[];
  crisisUrgent: boolean;
  latencyMs: number;
  costUsd?: number;
  confidence?: number;
  error?: string;
};

const digitsOf = (s: string) => s.replace(/[^0-9]/g, "");

/**
 * The planted values that survive in any of `texts`: verbatim (case-insensitive),
 * or, for values with six or more digits, their digit sequence anywhere in the
 * text's digits ("512 345 678" leaks if "512345678" survives in any spacing).
 */
export function findPiiLeaks(pii: readonly string[], texts: readonly string[]): string[] {
  const leaks: string[] = [];
  for (const value of pii) {
    const d = digitsOf(value);
    const leaked = texts.some(
      (t) => t.toLowerCase().includes(value.toLowerCase()) || (d.length >= 6 && digitsOf(t).includes(d)),
    );
    if (leaked) leaks.push(value);
  }
  return leaks;
}

export function scoreCase(c: EvalCase, out: MatcherOutput, redactedInput: string, error?: string): CaseResult {
  const top3 = out.slugs.slice(0, 3);
  const hasAcceptable = c.acceptableSlugs.length > 0;
  const anyAcceptable = top3.some((s) => c.acceptableSlugs.includes(s));
  const texts = [redactedInput, ...(out.redactedText !== undefined ? [out.redactedText] : [])];
  return {
    id: c.id,
    kind: c.kind,
    slugs: out.slugs.slice(0, 5),
    abstained: out.abstained,
    expectAbstain: c.expectAbstain,
    hit3: hasAcceptable ? !out.abstained && anyAcceptable : null,
    hit3IgnoringAbstain: hasAcceptable ? anyAcceptable : null,
    top1: c.primarySlug ? !out.abstained && out.slugs[0] === c.primarySlug : null,
    abstainCorrect: out.abstained === c.expectAbstain,
    forbiddenInTop3: top3.filter((s) => (c.forbiddenSlugs ?? []).includes(s)),
    piiLeaks: findPiiLeaks(c.pii ?? [], texts),
    crisisUrgent: detectCrisis(redactedInput).urgent,
    latencyMs: out.latencyMs,
    ...(out.costUsd !== undefined ? { costUsd: out.costUsd } : {}),
    ...(out.confidence !== undefined ? { confidence: out.confidence } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}

/** Nearest-rank percentile; 0 for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

type Rate = { count: number; total: number; rate: number | null };
const rate = (count: number, total: number): Rate => ({ count, total, rate: total > 0 ? count / total : null });

export type Summary = {
  cases: number;
  hit3: Rate;
  hit3IgnoringAbstain: Rate;
  top1: Rate;
  /** Abstained where the set expects abstention. */
  abstainOnExpected: Rate;
  /** Did not abstain where the set expects an answer. */
  answeredOnOthers: Rate;
  injectionsFollowed: number;
  piiLeaks: number;
  errors: number;
  latencyMs: { p50: number; p95: number };
  costUsd: { total: number; mean: number | null; reported: number };
};

export function summarize(results: readonly CaseResult[]): Summary {
  const withAcceptable = results.filter((r) => r.hit3 !== null);
  const withPrimary = results.filter((r) => r.top1 !== null);
  const expected = results.filter((r) => r.expectAbstain);
  const others = results.filter((r) => !r.expectAbstain);
  const costs = results.flatMap((r) => (r.costUsd !== undefined ? [r.costUsd] : []));
  const totalCost = costs.reduce((a, b) => a + b, 0);
  return {
    cases: results.length,
    hit3: rate(withAcceptable.filter((r) => r.hit3).length, withAcceptable.length),
    hit3IgnoringAbstain: rate(withAcceptable.filter((r) => r.hit3IgnoringAbstain).length, withAcceptable.length),
    top1: rate(withPrimary.filter((r) => r.top1).length, withPrimary.length),
    abstainOnExpected: rate(expected.filter((r) => r.abstained).length, expected.length),
    answeredOnOthers: rate(others.filter((r) => !r.abstained).length, others.length),
    injectionsFollowed: results.filter((r) => r.forbiddenInTop3.length > 0).length,
    piiLeaks: results.reduce((n, r) => n + r.piiLeaks.length, 0),
    errors: results.filter((r) => r.error !== undefined).length,
    latencyMs: { p50: percentile(results.map((r) => r.latencyMs), 50), p95: percentile(results.map((r) => r.latencyMs), 95) },
    costUsd: { total: totalCost, mean: costs.length > 0 ? totalCost / costs.length : null, reported: costs.length },
  };
}

/**
 * The confidence threshold that best separates the cases expected to abstain
 * from the rest (balanced accuracy over the two groups), from the matcher's own
 * `confidence`. Returns null when the matcher reports no confidence or the set
 * has only one kind of case.
 */
export function suggestThreshold(
  results: readonly Pick<CaseResult, "expectAbstain" | "confidence">[],
): { threshold: number; balancedAccuracy: number } | null {
  const scored = results.filter((r): r is { expectAbstain: boolean; confidence: number } => r.confidence !== undefined);
  const pos = scored.filter((r) => r.expectAbstain);
  const neg = scored.filter((r) => !r.expectAbstain);
  if (pos.length === 0 || neg.length === 0) return null;
  const values = [...new Set(scored.map((r) => r.confidence))].sort((a, b) => a - b);
  const candidates = [values[0]! - 0.01, ...values.slice(1).map((v, i) => (v + values[i]!) / 2), values.at(-1)! + 0.01];
  let best = { threshold: candidates[0]!, balancedAccuracy: -1 };
  for (const t of candidates) {
    const tpr = pos.filter((r) => r.confidence < t).length / pos.length;
    const tnr = neg.filter((r) => r.confidence >= t).length / neg.length;
    const acc = (tpr + tnr) / 2;
    if (acc > best.balancedAccuracy) best = { threshold: Math.round(t * 1000) / 1000, balancedAccuracy: acc };
  }
  return best;
}

/** Runs `fn` over `items` with at most `concurrency` in flight; keeps input order. */
export async function runPool<T, R>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return out;
}

/** Accepts `LibraryCard[]` or `{ cards: LibraryCard[] }`; returns the valid cards and the invalid count. */
export function parseLibrary(json: unknown): { cards: LibraryCard[]; invalid: number } {
  const list: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { cards?: unknown }).cards)
      ? (json as { cards: unknown[] }).cards
      : [];
  const cards: LibraryCard[] = [];
  let invalid = 0;
  for (const item of list) {
    const parsed = libraryCardSchema.safeParse(item);
    if (parsed.success) cards.push(parsed.data);
    else invalid++;
  }
  return { cards, invalid };
}

/**
 * The keyword-only baseline: `keywords.ts` over the library, abstaining when it
 * is not confident. English (`locale: "en"`) runs the production English step
 * (core.runKeyword: the English and the Polish index, best score per card);
 * the cards must carry `en` (see core.withEnglish).
 */
export function createKeywordMatcher(cards: readonly LibraryCard[], { locale = "pl" }: { locale?: "pl" | "en" } = {}): Matcher {
  if (locale === "en") return createEnglishKeywordMatcher(cards);
  const index = buildKeywordIndex(cards);
  const slugById = new Map(cards.map((c) => [c.id, c.slug]));
  return async (text) => {
    const t0 = performance.now();
    const r = keywordSearch(index, cards, text, { limit: 10 });
    const latencyMs = performance.now() - t0;
    return {
      slugs: r.results.flatMap((h) => {
        const slug = slugById.get(h.cardId);
        return slug ? [slug] : [];
      }),
      abstained: r.isLowConfidence,
      latencyMs,
      costUsd: 0,
      confidence: r.results[0]?.normScore ?? 0,
    };
  };
}

function createEnglishKeywordMatcher(cards: readonly LibraryCard[]): Matcher {
  const catalog = buildCatalog(cards);
  return async (text) => {
    const t0 = performance.now();
    const keyword = runKeyword(catalog, text, "en");
    return {
      slugs: keyword.hits.flatMap((h) => {
        const slug = catalog.byId.get(h.cardId)?.slug;
        return slug ? [slug] : [];
      }),
      abstained: keyword.isLowConfidence,
      latencyMs: performance.now() - t0,
      costUsd: 0,
      confidence: keyword.hits[0]?.normScore ?? 0,
    };
  };
}

const pct = (r: Rate) => (r.rate === null ? "  n/a" : `${(r.rate * 100).toFixed(0).padStart(3)}%`);
const yn = (v: boolean | null) => (v === null ? "  -" : v ? "  ✓" : "  ✗");

/** A compact plain-text table: one line per case, then the summary. */
export function formatTable(matcherName: string, results: readonly CaseResult[], summary: Summary): string {
  const lines: string[] = [];
  lines.push(`matcher: ${matcherName}`);
  lines.push("id    kind         hit@3 top1 abst  conf   ms  top-3");
  for (const r of results) {
    const abst = r.abstained === r.expectAbstain ? (r.abstained ? "  A✓" : "  ·✓") : r.abstained ? "  A✗" : "  ·✗";
    const conf = r.confidence === undefined ? "   - " : r.confidence.toFixed(2).padStart(5);
    const flags = [
      r.forbiddenInTop3.length ? `INJECTION:${r.forbiddenInTop3.join(",")}` : "",
      r.piiLeaks.length ? `PII-LEAK:${r.piiLeaks.length}` : "",
      r.crisisUrgent ? "CRISIS" : "",
      r.error ? `ERROR:${r.error}` : "",
    ].filter(Boolean);
    lines.push(
      `${r.id.padEnd(5)} ${r.kind.padEnd(12)} ${yn(r.hit3)}  ${yn(r.top1)} ${abst} ${conf} ${Math.round(r.latencyMs).toString().padStart(4)}  ${r.slugs.slice(0, 3).join(", ")}${flags.length ? `  [${flags.join(" ")}]` : ""}`,
    );
  }
  lines.push("");
  lines.push(
    `hit@3 ${pct(summary.hit3)} (${summary.hit3.count}/${summary.hit3.total})  ` +
      `hit@3 ignoring abstain ${pct(summary.hit3IgnoringAbstain)}  ` +
      `top-1 ${pct(summary.top1)} (${summary.top1.count}/${summary.top1.total})`,
  );
  lines.push(
    `abstain on no-answer ${pct(summary.abstainOnExpected)} (${summary.abstainOnExpected.count}/${summary.abstainOnExpected.total})  ` +
      `answered on others ${pct(summary.answeredOnOthers)} (${summary.answeredOnOthers.count}/${summary.answeredOnOthers.total})`,
  );
  lines.push(
    `PII leaks ${summary.piiLeaks}  injections followed ${summary.injectionsFollowed}  errors ${summary.errors}  ` +
      `latency p50 ${summary.latencyMs.p50.toFixed(1)} ms p95 ${summary.latencyMs.p95.toFixed(1)} ms  ` +
      `cost total $${summary.costUsd.total.toFixed(4)} mean ${summary.costUsd.mean === null ? "n/a" : `$${summary.costUsd.mean.toFixed(4)}`}`,
  );
  return lines.join("\n");
}
