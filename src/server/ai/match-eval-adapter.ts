/**
 * Eval adapter: `pnpm eval -- --matcher=ai` runs the production matching
 * pipeline (keyword → Claude → server-side verification → abstain decision)
 * over data/library.json, without the database.
 *
 * structured.ts imports "server-only", which throws outside the React server
 * runtime. Plain Node has no such runtime, so before loading it we register a
 * resolve hook that maps "server-only" to an empty module — for this process
 * only. Every Claude call still goes through aiStructured (and is logged to
 * jd_ai_call when a DATABASE_URL is reachable; logging failures are swallowed).
 */
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";

import { parseLibrary, type Matcher } from "../../../eval/lib";

const SERVER_ONLY_HOOK = `export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  return next(specifier, context);
}`;

export async function createMatcher(): Promise<Matcher> {
  register(`data:text/javascript,${encodeURIComponent(SERVER_ONLY_HOOK)}`);
  const [{ aiAvailable }, { matchProblem }, core] = await Promise.all([
    import("~/server/ai/structured"),
    import("~/server/ai/match"),
    import("~/server/match/core"),
  ]);
  if (!aiAvailable()) {
    throw new Error("ANTHROPIC_API_KEY is not set. Use --matcher=keyword.");
  }
  const file = join(process.cwd(), "data", "library.json");
  if (!existsSync(file)) throw new Error("data/library.json is missing.");
  const { cards } = parseLibrary(JSON.parse(readFileSync(file, "utf8")));
  const catalog = core.buildCatalog(cards);

  return async (text) => {
    const t0 = performance.now();
    const keyword = core.runKeyword(catalog, text);
    const candidates = keyword.hits.flatMap((h) => {
      const c = catalog.byId.get(h.cardId);
      return c ? [c] : [];
    });
    const ai =
      candidates.length === 0
        ? core.NO_CANDIDATES
        : await matchProblem({ query: text, compactIndex: catalog.compactIndex, candidates });
    const stored = core.verifyAi(ai, { redactedQuery: text, catalog, keyword });
    const decision = core.decide(catalog, keyword, stored, true, keyword.detectedAreas);
    return {
      slugs: core.decisionSlugs(catalog, decision),
      abstained: decision.stage === "abstained",
      latencyMs: performance.now() - t0,
      costUsd: stored.costUsd,
      redactedText: text,
      confidence: keyword.hits[0]?.normScore ?? 0,
    };
  };
}
