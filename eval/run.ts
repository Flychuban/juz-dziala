/**
 * Runs the frozen evaluation set against a matcher.
 *
 *   pnpm eval                       # keyword baseline over data/library.json
 *   pnpm eval --matcher=ai          # the AI matcher, once src/server/ai/match-eval-adapter.ts exists
 *   pnpm eval --library=path.json   # another library file
 *
 * Every case text is redacted with redactPII before it reaches the matcher.
 * Results go to eval/results/<matcher>-<ISO timestamp>.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { redactPII } from "../src/server/domain/redact";
import {
  createKeywordMatcher,
  evalSetSchema,
  formatTable,
  parseLibrary,
  runPool,
  scoreCase,
  suggestThreshold,
  summarize,
  type Matcher,
  type MatcherOutput,
} from "./lib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONCURRENCY = 2;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

/**
 * ── AI MATCHER HOOK ────────────────────────────────────────────────────────
 * `--matcher=ai` loads src/server/ai/match-eval-adapter.ts (imported as
 * `~/server/ai/match-eval-adapter` elsewhere). The module must export one of:
 *   export async function createMatcher(): Promise<Matcher>
 *   export const matcher: Matcher
 *   export default Matcher
 * where Matcher = (text) => Promise<{ slugs, abstained, latencyMs, costUsd?, redactedText?, confidence? }>.
 * The text it receives is already redacted.
 */
async function loadAiMatcher(): Promise<Matcher | null> {
  const candidates = ["match-eval-adapter.ts", "match-eval-adapter.js", "match-eval-adapter/index.ts"].map((f) =>
    join(ROOT, "src/server/ai", f),
  );
  const file = candidates.find((f) => existsSync(f));
  if (!file) return null;
  const mod = (await import(pathToFileURL(file).href)) as {
    createMatcher?: () => Matcher | Promise<Matcher>;
    matcher?: Matcher;
    default?: Matcher;
  };
  if (typeof mod.createMatcher === "function") return await mod.createMatcher();
  if (typeof mod.matcher === "function") return mod.matcher;
  if (typeof mod.default === "function") return mod.default;
  throw new Error(`${file} exports neither createMatcher, matcher nor a default Matcher`);
}

async function main(): Promise<void> {
  const matcherName = arg("matcher") ?? "keyword";
  const casesPath = resolve(ROOT, arg("cases") ?? "eval/cases.json");
  const libraryPath = resolve(ROOT, arg("library") ?? "data/library.json");
  const outDir = resolve(ROOT, arg("out") ?? "eval/results");

  const set = evalSetSchema.parse(JSON.parse(readFileSync(casesPath, "utf8")));

  let librarySlugs: Set<string> | null = null;
  let libraryCards = 0;
  let matcher: Matcher;
  if (matcherName === "keyword") {
    if (!existsSync(libraryPath)) {
      console.log(`No library at ${libraryPath}.`);
      console.log("The keyword baseline needs data/library.json (produced by `pnpm data:library`). Nothing to evaluate yet.");
      return;
    }
    const { cards, invalid } = parseLibrary(JSON.parse(readFileSync(libraryPath, "utf8")));
    if (invalid > 0) console.warn(`warning: ${invalid} library entries do not match LibraryCard and were skipped`);
    if (cards.length === 0) {
      console.log(`The library at ${libraryPath} holds no valid cards. Nothing to evaluate.`);
      return;
    }
    librarySlugs = new Set(cards.map((c) => c.slug));
    libraryCards = cards.length;
    matcher = createKeywordMatcher(cards);
  } else if (matcherName === "ai") {
    const ai = await loadAiMatcher();
    if (!ai) {
      console.log("No AI adapter at src/server/ai/match-eval-adapter.ts yet. Nothing to evaluate.");
      return;
    }
    matcher = ai;
    if (existsSync(libraryPath)) {
      const { cards } = parseLibrary(JSON.parse(readFileSync(libraryPath, "utf8")));
      librarySlugs = new Set(cards.map((c) => c.slug));
      libraryCards = cards.length;
    }
  } else {
    console.error(`Unknown --matcher=${matcherName}. Use keyword or ai.`);
    process.exitCode = 1;
    return;
  }

  if (librarySlugs) {
    const missing = set.cases.flatMap((c) =>
      [...c.acceptableSlugs, ...(c.primarySlug ? [c.primarySlug] : [])].filter((s) => !librarySlugs.has(s)).map((s) => `${c.id}:${s}`),
    );
    if (missing.length > 0) console.warn(`warning: slugs in cases.json not in the library: ${[...new Set(missing)].join(", ")}`);
  }

  const startedAt = new Date();
  const results = await runPool(set.cases, CONCURRENCY, async (c) => {
    const redacted = redactPII(c.text).text;
    let out: MatcherOutput;
    let error: string | undefined;
    const t0 = performance.now();
    try {
      out = await matcher(redacted);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      out = { slugs: [], abstained: false, latencyMs: performance.now() - t0 };
    }
    return scoreCase(c, out, redacted, error);
  });
  const summary = summarize(results);
  const threshold = suggestThreshold(results);

  mkdirSync(outDir, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outFile = join(outDir, `${matcherName}-${stamp}.json`);
  writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        matcher: matcherName,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        casesFile: casesPath,
        casesFrozenAt: set.frozenAt,
        library: { path: libraryPath, cards: libraryCards },
        summary,
        suggestedLowConfidenceThreshold: threshold,
        results,
      },
      null,
      2,
    )}\n`,
  );

  console.log(formatTable(matcherName, results, summary));
  if (threshold) {
    console.log(
      `suggested low-confidence threshold on this run: ${threshold.threshold} (balanced abstain accuracy ${(threshold.balancedAccuracy * 100).toFixed(0)}%)`,
    );
  }
  console.log(`written: ${outFile}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
