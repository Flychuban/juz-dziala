import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { type Db } from "~/server/db";
import { aiCalls } from "~/server/db/schema";

export type AiFnStats = {
  fn: string;
  calls: number;
  failed: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Share of input served from cache: read / (read + write + uncached). */
  cacheReadPct: number;
  totalCostUsd: number;
  avgCostUsd: number;
  lastAt: Date | null;
};

/** One row per AI function from jd_ai_call (all time), most expensive first. */
export async function aiStatsByFn(db: Db): Promise<AiFnStats[]> {
  const rows = await db
    .select({
      fn: aiCalls.fn,
      calls: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where not ${aiCalls.ok})::int`,
      avgLatencyMs: sql<number>`coalesce(avg(${aiCalls.latencyMs}), 0)::float`,
      p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${aiCalls.latencyMs}), 0)::float`,
      inputTokens: sql<number>`coalesce(sum(${aiCalls.inputTokens}), 0)::float`,
      outputTokens: sql<number>`coalesce(sum(${aiCalls.outputTokens}), 0)::float`,
      cacheReadTokens: sql<number>`coalesce(sum(${aiCalls.cacheReadTokens}), 0)::float`,
      cacheWriteTokens: sql<number>`coalesce(sum(${aiCalls.cacheWriteTokens}), 0)::float`,
      totalCostUsd: sql<number>`coalesce(sum(${aiCalls.costUsd}), 0)::float`,
      lastAt: sql<Date | null>`max(${aiCalls.createdAt})`,
    })
    .from(aiCalls)
    .groupBy(aiCalls.fn);
  return rows
    .map((r) => {
      const allIn = r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens;
      return {
        ...r,
        lastAt: r.lastAt ? new Date(r.lastAt) : null,
        cacheReadPct: allIn > 0 ? r.cacheReadTokens / allIn : 0,
        avgCostUsd: r.calls > 0 ? r.totalCostUsd / r.calls : 0,
      };
    })
    .sort(
      (a, b) => b.totalCostUsd - a.totalCostUsd || a.fn.localeCompare(b.fn),
    );
}

const rate = z
  .object({ count: z.number(), total: z.number(), rate: z.number().nullable() })
  .partial();
const evalFileSchema = z
  .object({
    matcher: z.string(),
    startedAt: z.string(),
    casesFrozenAt: z.string().optional(),
    summary: z
      .object({
        cases: z.number(),
        hit3: rate,
        top1: rate,
        abstainOnExpected: rate,
        answeredOnOthers: rate,
        injectionsFollowed: z.number(),
        piiLeaks: z.number(),
        errors: z.number(),
        latencyMs: z.object({ p50: z.number(), p95: z.number() }).partial(),
        costUsd: z.object({ total: z.number(), mean: z.number() }).partial(),
      })
      .partial(),
  })
  .loose();
export type EvalSummary = z.infer<typeof evalFileSchema> & { file: string };

/** Newest eval/results/*.json per matcher (keyword, ai, …), newest first. */
export async function latestEvals(): Promise<EvalSummary[]> {
  const dir = path.join(process.cwd(), "eval", "results");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const newest = new Map<string, EvalSummary>();
  for (const f of files) {
    try {
      const parsed = evalFileSchema.safeParse(
        JSON.parse(await readFile(path.join(dir, f), "utf8")),
      );
      if (!parsed.success) continue;
      const cur = newest.get(parsed.data.matcher);
      if (!cur || cur.startedAt < parsed.data.startedAt)
        newest.set(parsed.data.matcher, { ...parsed.data, file: f });
    } catch {
      /* skip unreadable file */
    }
  }
  return [...newest.values()].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
}
