import { TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";

import { loadPlanContext } from "~/server/adapt/context";
import {
  PLAN_MODE_HEADER,
  planInputSchema,
  type PlanMode,
} from "~/server/adapt/options";
import { assemblePlanStream } from "~/server/adapt/plan-stream";
import {
  FIXED_SECTIONS,
  planFooter,
  planHeader,
  templatePlan,
  templateSections,
} from "~/server/adapt/plan-template";
import { aiAvailable, aiStream } from "~/server/ai/structured";
import {
  ADAPT_PLAN_SYSTEM,
  adaptPlanUserMessage,
} from "~/server/ai/prompts/adapt-plan";
import { createTRPCContext, rateLimit } from "~/server/api/trpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function problem(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * POST /api/adapt/plan — the Ramowy Plan Wdrożenia as streamed Markdown.
 *
 * With Claude: the model writes the narrative sections and this handler
 * splices in the server-computed ones (GUS scale, budget ranges, calls) and
 * resolves every card quote by sentence id. Without Claude: the whole plan
 * comes from the deterministic template. `x-plan-mode` says which.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Nieprawidłowe dane formularza.");
  }
  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    return problem(
      400,
      parsed.error.issues[0]?.message ?? "Uzupełnij wszystkie odpowiedzi.",
    );
  }

  const trpcCtx = await createTRPCContext({ headers: req.headers });
  const useAi = aiAvailable();
  try {
    await rateLimit(
      trpcCtx,
      useAi ? "adapt.plan.ai" : "adapt.plan.template",
      useAi ? { limit: 6, windowSec: 600 } : { limit: 30, windowSec: 600 },
    );
  } catch (e) {
    if (e instanceof TRPCError && e.code === "TOO_MANY_REQUESTS") {
      return problem(429, e.message);
    }
    throw e;
  }

  const loaded = await loadPlanContext(trpcCtx.db, parsed.data);
  if (!loaded.ok) {
    return problem(
      404,
      loaded.reason === "innovation"
        ? "Nie znaleźliśmy tej innowacji w Bibliotece. Wybierz ją ponownie."
        : "Nie znaleźliśmy tej gminy. Wybierz ją z listy.",
    );
  }
  const ctx = loaded.ctx;

  const headers = (mode: PlanMode) => ({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    [PLAN_MODE_HEADER]: mode,
  });

  if (!useAi) {
    return new Response(templatePlan(ctx), { headers: headers("template") });
  }

  const source = aiStream({
    fn: "adapt.plan",
    system: ADAPT_PLAN_SYSTEM,
    user: adaptPlanUserMessage(ctx),
    effort: "medium",
    maxTokens: 8000,
  });
  const stream = assemblePlanStream(source, {
    header: planHeader(ctx),
    sections: templateSections(ctx),
    fixed: FIXED_SECTIONS,
    sentences: new Map(ctx.card.sentences.map((s) => [s.id, s.text])),
    footer: ({ fallbackUsed }) => planFooter(ctx, "ai", { fallbackUsed }),
  });
  return new Response(stream, { headers: headers("ai") });
}
