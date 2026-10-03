import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { IDEA_APPLICATION_SYSTEM } from "~/server/ai/prompts/ideas";
import { aiAvailable, aiStream, userData } from "~/server/ai/structured";
import { createTRPCContext, rateLimit } from "~/server/api/trpc";
import { templateDraft, type DraftSource } from "~/server/ideas/application-rules";
import { canvasToText } from "~/server/ideas/canvas-def";
import { applicationCall, loadCanvasDef } from "~/server/ideas/data";
import { loadIdeaCase } from "~/server/ideas/idea-case";
import { IDEA_STAGE_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";

/**
 * POST /api/ideas/application — the application draft for an idea Sprawa,
 * streamed as Markdown („## <pole>" per form field). The idea and Canvas are
 * read from the database by the case code, never taken from the request.
 *
 * Without an API key (or when the call fails to start) the response is the
 * AI-free template draft; the header `X-Draft-Source` says which one it is.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().trim().min(1).max(40), token: z.string().max(200).optional() });

function text(status: number, message: string) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return text(400, "Brak kodu sprawy.");

  const ctx = await createTRPCContext({ headers: req.headers });
  try {
    await rateLimit(ctx, "ideas.application.draft", { limit: 6, windowSec: 600 });
    const c = await loadIdeaCase(ctx, parsed.data.code, parsed.data.token);
    const call = await applicationCall();
    if (!call) return text(409, "Teraz nie trwa żaden nabór, do którego można przygotować wniosek.");
    const def = await loadCanvasDef();

    const src: DraftSource = {
      title: c.idea.title,
      description: c.idea.description,
      targetGroup: c.idea.targetGroup,
      areas: c.idea.areas,
      stage: c.idea.stage,
      canvasNotes: c.canvas?.notes ?? {},
      canvasPicks: c.canvas?.picks ?? {},
    };
    const headers = {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Call-Id": call.id,
    };

    if (!aiAvailable()) {
      return new Response(templateDraft(call.formFields, src), { headers: { ...headers, "X-Draft-Source": "template" } });
    }

    const fiszka = [
      `Nazwa: ${src.title}`,
      `Na czym polega: ${src.description}`,
      `Komu pomaga: ${src.targetGroup}`,
      `Obszary: ${src.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ") || "—"}`,
      `Etap: ${src.stage ? IDEA_STAGE_LABEL[src.stage] : "—"}`,
    ].join("\n");
    const canvas = def && c.canvas ? canvasToText(def, c.canvas) : "";
    const user = [
      `Nabór: ${call.name}${call.status === "demo" ? " (nabór przykładowy — demo)" : ""}`,
      "",
      "Pola formularza, w tej kolejności (etykieta — podpowiedź):",
      ...call.formFields.map((f, i) => `${i + 1}. ${f.label} — ${f.hint ?? "brak podpowiedzi"}`),
      "",
      "Fiszka autora:",
      userData("fiszka", fiszka),
      "",
      "Canvas autora (Social Innovation Canvas INNO AGH):",
      userData("canvas", canvas || "(autor nie wypełnił Canvasu)"),
    ].join("\n");

    const stream = aiStream({
      fn: "ideas.application",
      system: [{ text: IDEA_APPLICATION_SYSTEM, cache: true }],
      user,
      effort: "medium",
      maxTokens: 6000,
    });
    return new Response(stream, { headers: { ...headers, "X-Draft-Source": "ai" } });
  } catch (e) {
    if (e instanceof TRPCError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "TOO_MANY_REQUESTS" ? 429 : 400;
      return text(status, e.message);
    }
    console.error("[ideas.application] draft failed", e);
    return text(500, "Nie udało się przygotować szkicu. Spróbuj ponownie.");
  }
}
