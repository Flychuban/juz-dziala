import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { translatorFor } from "~/i18n/server";
import { IDEA_APPLICATION_SYSTEM } from "~/server/ai/prompts/ideas";
import { AI_STREAM_LINES, aiReady, aiStream, userData } from "~/server/ai/structured";
import { createTRPCContext, rateLimit } from "~/server/api/trpc";
import { fixedTexts, templateDraft, type DraftSource } from "~/server/ideas/application-template";
import { canvasToText, pickLabel } from "~/server/ideas/canvas-def";
import { applicationCallById, loadCanvasDef, loadCanvasView, localizeCall } from "~/server/ideas/data";
import { markFailure } from "~/server/ideas/draft-stream";
import { loadIdeaCase } from "~/server/ideas/idea-case";
import { GAP, GAP_EN } from "~/server/ideas/schema";
import { IDEA_STAGE_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";

/**
 * POST /api/ideas/application — the application draft for an idea Sprawa and
 * one chosen call, streamed as Markdown („## <pole>" per form field of THAT
 * call), in the visitor's language. The idea and Canvas are read from the
 * database by the case code, never taken from the request.
 *
 * `X-Draft-Source` tells the truth: "template" when the assistant cannot be
 * reached now (no key, hourly budget used up) or the person asked for the
 * template; "ai" only when Claude writes. If Claude stops mid-way, the failure
 * line is replaced by DRAFT_FAILED_MARKER so the page shows an error instead of
 * filling the form with a broken draft.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
/** Stop the model before the platform stops the function. */
const DEADLINE_MS = 100_000;

const bodySchema = z.object({
  code: z.string().trim().min(1).max(40),
  token: z.string().max(200).optional(),
  callId: z.string().trim().min(1).max(64),
  mode: z.enum(["auto", "template"]).default("auto"),
});

function text(status: number, message: string) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** The lines aiStream writes instead of a document (both languages). */
const FAILURE_LINES: string[] = Object.values(AI_STREAM_LINES).flatMap((l) => Object.values(l));

export async function POST(req: Request) {
  const ctx = await createTRPCContext({ headers: req.headers });
  const tr = translatorFor(ctx.locale, "ideas");
  const t = (k: "noCode" | "noCall" | "failed") => tr(`application.server.${k}`);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return text(400, t("noCode"));
  const locale = ctx.locale;

  try {
    const c = await loadIdeaCase(ctx, parsed.data.code, parsed.data.token);
    const found = await applicationCallById(parsed.data.callId);
    if (!found) return text(409, t("noCall"));
    const call = localizeCall(found, locale);
    const [def, view] = await Promise.all([loadCanvasDef(), loadCanvasView(locale)]);

    const src: DraftSource = {
      title: c.idea.title,
      description: c.idea.description,
      targetGroup: c.idea.targetGroup,
      areas: c.idea.areas,
      stage: c.idea.stage,
      canvasNotes: c.canvas?.notes ?? {},
      canvasPicks: c.canvas?.picks ?? {},
      similar: c.idea.similar.map((s) => s.title),
    };
    const headers = {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Call-Id": call.id,
    };
    const template = () => {
      const label = view ? (key: string, value: string) => pickLabel(view, key, value) : undefined;
      return new Response(templateDraft(call.formFields, src, locale, label), {
        headers: { ...headers, "X-Draft-Source": "template" },
      });
    };

    // Cheap requests (the template) and AI ones are limited separately.
    const useAi = parsed.data.mode === "auto" && (await aiReady());
    await rateLimit(
      ctx,
      useAi ? "ideas.application.ai" : "ideas.application.template",
      useAi ? { limit: 6, windowSec: 600 } : { limit: 30, windowSec: 600 },
    );
    if (!useAi) return template();

    const fiszka = [
      `Nazwa: ${src.title}`,
      `Na czym polega: ${src.description}`,
      `Komu pomaga: ${src.targetGroup}`,
      `Obszary: ${src.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ") || "—"}`,
      `Etap: ${src.stage ? IDEA_STAGE_LABEL[src.stage] : "—"}`,
      src.similar?.length ? `Podobne rozwiązania w Bibliotece: ${src.similar.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const canvas = def && c.canvas ? canvasToText(def, c.canvas) : "";
    const fixed = fixedTexts(locale);
    const user = [
      `Nabór: ${call.name}${call.status === "demo" ? " (nabór przykładowy — demo)" : ""}`,
      call.program ? `Program: ${call.program}` : "",
      call.eligibility.length ? `Kto może składać wnioski:\n${call.eligibility.map((e) => `- ${e}`).join("\n")}` : "",
      call.notes ? `O naborze: ${call.notes}` : "",
      "",
      "Pola formularza TEGO naboru, w tej kolejności (etykieta — podpowiedź). Nagłówki „## ” przepisz dokładnie:",
      ...call.formFields.map((f, i) => `${i + 1}. ${f.label} — ${f.hint ?? "brak podpowiedzi"}`),
      "",
      call.criteria.length
        ? [
            "Kryteria oceny TEGO naboru — pisz tak, żeby oceniający znalazł w szkicu odpowiedź na każde z nich (bez wymyślania faktów):",
            ...call.criteria.map((k) => `- ${k.label} (0–${k.max} pkt): ${k.description ?? ""}`),
          ].join("\n")
        : "",
      "",
      "Fiszka autora:",
      userData("fiszka", fiszka),
      "",
      "Canvas autora (Social Innovation Canvas INNO AGH):",
      userData("canvas", canvas || "(autor nie wypełnił Canvasu)"),
      "",
      locale === "en"
        ? `Szkic piszesz po angielsku. Zamiast „${GAP}” pisz dokładnie „${GAP_EN}”. Pole z danymi wnioskodawcy: „${fixed.applicant}”. Pole z oświadczeniami: „${fixed.declarations}”.`
        : "",
    ]
      .filter((l, i, all) => l !== "" || all[i - 1] !== "")
      .join("\n");

    const stream = aiStream({
      fn: "ideas.application",
      system: [{ text: IDEA_APPLICATION_SYSTEM, cache: true }],
      user,
      locale,
      effort: "medium",
      maxTokens: 6000,
      deadlineMs: DEADLINE_MS,
    });
    return new Response(markFailure(stream, FAILURE_LINES), { headers: { ...headers, "X-Draft-Source": "ai" } });
  } catch (e) {
    if (e instanceof TRPCError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "TOO_MANY_REQUESTS" ? 429 : 400;
      // „No such case" comes from the case engine in Polish; ours are already translated.
      const ti = translatorFor(locale, "ideas");
      const missing = e.code === "NOT_FOUND" && e.message !== ti("access.notIdea");
      return text(status, missing ? ti("notFound.missing") : e.message);
    }
    console.error("[ideas.application] draft failed", e);
    return text(500, t("failed"));
  }
}
