import "server-only";

import { aiStructured, userData } from "~/server/ai/structured";
import { IDEA_ASSIST_SYSTEM } from "~/server/ai/prompts/ideas";
import { MAPA_AREA_LABEL, IDEA_STAGE_LABEL } from "~/lib/domain";
import { redactPII } from "~/server/domain/redact";
import { assistOutputSchema, finalizeAssist, type AssistResult } from "./assist-rules";
import { scoringCall } from "./data";
import type { IdeaAssistData } from "./schema";

export type AssistResponse =
  | { ok: true; result: AssistResult; criteriaSource: { callId: string; name: string } | null }
  | { ok: false; reason: "unavailable" | "failed" };

/**
 * The Kreator's AI panel: 3 sharpening questions, 3 unusual angles, the Mapa
 * areas the idea fits, and a self-assessment on the IWS 2.0 merit criteria.
 * Text is redacted before it leaves the server; the criteria come from the
 * call in the database, not from the prompt.
 */
export async function assistIdea(input: IdeaAssistData): Promise<AssistResponse> {
  const call = await scoringCall();
  const criteriaText = call
    ? call.criteria
        .map((c) => `- ${c.key} — ${c.label} (0–${c.max} pkt${c.minToPass != null ? `, minimum ${c.minToPass}` : ""}): ${c.description ?? ""}`)
        .join("\n")
    : "(brak kryteriów — zwróć pustą listę selfScore)";

  const fiszka = [
    `Nazwa: ${input.title}`,
    `Na czym polega: ${input.description}`,
    `Komu pomaga: ${input.targetGroup}`,
    `Obszary wybrane przez autora: ${input.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ") || "—"}`,
    `Etap: ${input.stage ? IDEA_STAGE_LABEL[input.stage] : "—"}`,
  ].join("\n");

  const user = [
    `Kryteria oceny merytorycznej (nabór ${call?.name ?? "—"}, minimum łącznie ${call?.minScore ?? "—"} pkt):`,
    criteriaText,
    "",
    "Fiszka pomysłu:",
    userData("fiszka", redactPII(fiszka).text),
  ].join("\n");

  const res = await aiStructured({
    fn: "ideas.assist",
    schema: assistOutputSchema,
    system: [{ text: IDEA_ASSIST_SYSTEM, cache: true }],
    user,
    effort: "low",
    maxTokens: 4000,
    timeoutMs: 40_000,
  });
  if (!res.ok) return { ok: false, reason: res.reason === "unavailable" ? "unavailable" : "failed" };
  return {
    ok: true,
    result: finalizeAssist(res.data, {
      id: call?.id ?? "",
      criteria: call?.criteria.map((c) => ({ key: c.key, label: c.label, max: c.max, minToPass: c.minToPass ?? null })) ?? [],
      minScore: call?.minScore ?? null,
    }),
    criteriaSource: call ? { callId: call.id, name: call.name } : null,
  };
}
