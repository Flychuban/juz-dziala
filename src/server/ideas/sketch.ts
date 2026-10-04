import "server-only";

import type { Locale } from "~/i18n/config";
import { IDEA_SKETCH_SYSTEM } from "~/server/ai/prompts/ideas";
import { aiStructured, userData } from "~/server/ai/structured";
import { IDEA_STAGE_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";
import { redactPII } from "~/server/domain/redact";
import type { IdeaAssistData } from "./schema";
import { finalizeSketch, sketchOutputSchema, type Sketch } from "./sketch-rules";

export type SketchResponse = { ok: true; sketch: Sketch } | { ok: false; reason: "unavailable" | "failed" };

/**
 * „Narysuj szkic pomysłu": the model returns shapes as numbers (sketch-rules.ts
 * checks and clamps every one); the page draws the SVG itself. Text is
 * redacted before it leaves the server.
 */
export async function sketchIdea(input: IdeaAssistData, locale: Locale): Promise<SketchResponse> {
  const fiszka = [
    `Nazwa: ${input.title}`,
    `Na czym polega: ${input.description}`,
    `Komu pomaga: ${input.targetGroup}`,
    `Obszary: ${input.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ") || "—"}`,
    `Etap: ${input.stage ? IDEA_STAGE_LABEL[input.stage] : "—"}`,
  ].join("\n");
  const res = await aiStructured({
    fn: "ideas.sketch",
    schema: sketchOutputSchema,
    system: [{ text: IDEA_SKETCH_SYSTEM, cache: true }],
    user: ["Narysuj szkic tego pomysłu:", userData("fiszka", redactPII(fiszka).text)].join("\n"),
    locale,
    effort: "low",
    maxTokens: 4000,
    timeoutMs: 40_000,
  });
  if (!res.ok) return { ok: false, reason: res.reason === "unavailable" ? "unavailable" : "failed" };
  const sketch = finalizeSketch(res.data);
  return sketch ? { ok: true, sketch } : { ok: false, reason: "failed" };
}
