import { aiStatsByFn, latestEvals } from "~/server/admin/ai-stats";
import { createTRPCRouter, roleProcedure } from "~/server/api/trpc";

/** VI · AI cost and quality (ROPS only). */
export const adminAiRouter = createTRPCRouter({
  /** Per-function usage from jd_ai_call and the newest eval result per matcher. */
  summary: roleProcedure("rops").query(async ({ ctx }) => {
    const [byFn, evals] = await Promise.all([
      aiStatsByFn(ctx.db),
      latestEvals(),
    ]);
    const totals = byFn.reduce(
      (t, r) => ({
        calls: t.calls + r.calls,
        failed: t.failed + r.failed,
        costUsd: t.costUsd + r.totalCostUsd,
        inputTokens: t.inputTokens + r.inputTokens,
        outputTokens: t.outputTokens + r.outputTokens,
      }),
      { calls: 0, failed: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 },
    );
    return { byFn, totals, evals };
  }),
});
