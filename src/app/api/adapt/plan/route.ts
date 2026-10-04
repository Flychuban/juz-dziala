import { TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";

import { translatorFor } from "~/i18n/server";
import { loadPlanContext } from "~/server/adapt/context";
import {
  isValidationKey,
  MAX_NEEDS_CHARS,
  PLAN_MODE_HEADER,
  planInputSchema,
  planSourceMarker,
} from "~/server/adapt/options";
import { assemblePlanStream } from "~/server/adapt/plan-stream";
import {
  FIXED_SECTIONS,
  planFooter,
  planHeader,
  planSentences,
  templatePlan,
  templateSections,
  todoMarker,
} from "~/server/adapt/plan-template";
import { AI_STREAM_LINES, aiReady, aiStream } from "~/server/ai/structured";
import {
  ADAPT_PLAN_SYSTEM,
  adaptPlanUserMessage,
} from "~/server/ai/prompts/adapt-plan";
import { createTRPCContext, rateLimit } from "~/server/api/trpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The model gets this long; then it is aborted, `aiStream` writes its failure
 * line and closes, and the template fills every section it did not finish —
 * well inside `maxDuration`.
 */
const AI_DEADLINE_MS = 90_000;

/** Every failure line `aiStream` can write, in both languages. */
const FAILURE_LINES = Object.values(AI_STREAM_LINES).flatMap((l) =>
  Object.values(l),
);

function problem(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * POST /api/adapt/plan — the Ramowy Plan Wdrożenia as streamed Markdown, in
 * the visitor's language.
 *
 * With Claude: the model writes the narrative sections and this handler
 * splices in the server-computed ones (GUS scale, budget ranges, calls) and
 * resolves every card quote by sentence id. Without Claude (no key, or the
 * hourly budget is spent — `aiReady()`): the whole plan comes from the
 * deterministic template.
 *
 * `x-plan-mode` says what was attempted: "template", or "ai". Whether the
 * model actually wrote every section is known only at the end, so an "ai"
 * body ends with `<!-- plan-source: ai|mixed|template -->` (read and removed
 * by the browser); the footer says the same in words.
 */
export async function POST(req: NextRequest) {
  const trpcCtx = await createTRPCContext({ headers: req.headers });
  const locale = trpcCtx.locale;
  const t = translatorFor(locale, "adapt");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, t("errors.badForm"));
  }
  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message;
    return problem(
      400,
      isValidationKey(key)
        ? t(`validation.${key}`, { max: MAX_NEEDS_CHARS })
        : t("errors.incomplete"),
    );
  }

  const useAi = await aiReady();
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

  const loaded = await loadPlanContext(trpcCtx.db, parsed.data, locale);
  if (!loaded.ok) {
    return problem(
      404,
      loaded.reason === "innovation"
        ? t("errors.innovationNotFound")
        : t("errors.gminaNotFound"),
    );
  }
  const ctx = loaded.ctx;

  const headers = (mode: "ai" | "template") => ({
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
    locale,
    effort: "medium",
    maxTokens: 8000,
    deadlineMs: AI_DEADLINE_MS,
  });
  const stream = assemblePlanStream(source, {
    header: planHeader(ctx),
    sections: templateSections(ctx),
    fixed: FIXED_SECTIONS,
    sentences: planSentences(ctx.card, locale),
    locale,
    todo: todoMarker(locale),
    failureLines: FAILURE_LINES,
    footer: (s) => planFooter(ctx, s),
    trailer: planSourceMarker,
  });
  return new Response(stream, { headers: headers("ai") });
}
