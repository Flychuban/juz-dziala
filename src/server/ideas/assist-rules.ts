/**
 * Pure post-processing of the assistant's answer (unit-tested): nothing the
 * model returns reaches the page unchecked. Areas must be real Mapa keys,
 * criteria must be the call's own, scores are clipped to their scale, and the
 * total is computed here — never taken from the model.
 */
import { z } from "zod";

import { MAPA_AREAS, type MapaArea } from "~/lib/domain";
import type { SelfScore } from "./schema";

/** What the model is asked for. Permissive on purpose (the SDK drops min/max). */
export const assistOutputSchema = z.object({
  questions: z.array(z.string()),
  angles: z.array(z.object({ title: z.string(), idea: z.string() })),
  areaFit: z.array(z.object({ area: z.string(), why: z.string() })),
  selfScore: z.array(
    z.object({ key: z.string(), score: z.number(), reason: z.string(), improve: z.string() }),
  ),
});
export type AssistOutput = z.infer<typeof assistOutputSchema>;

export type ScoringCriterion = { key: string; label: string; max: number; minToPass?: number | null };

export type AssistResult = {
  questions: string[];
  angles: { title: string; idea: string }[];
  areaFit: { area: MapaArea; why: string }[];
  /** null when the model skipped a criterion — a partial score would mislead. */
  selfScore: SelfScore | null;
};

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

export function finalizeAssist(
  out: AssistOutput,
  call: { id: string; criteria: ScoringCriterion[]; minScore: number | null },
): AssistResult {
  const questions = out.questions.map((q) => clip(q, 300)).filter(Boolean).slice(0, 3);
  const angles = out.angles
    .map((a) => ({ title: clip(a.title, 80), idea: clip(a.idea, 400) }))
    .filter((a) => a.title && a.idea)
    .slice(0, 3);

  const seen = new Set<MapaArea>();
  const areaFit: AssistResult["areaFit"] = [];
  for (const a of out.areaFit) {
    const key = a.area.trim() as MapaArea;
    if (!(MAPA_AREAS as readonly string[]).includes(key) || seen.has(key)) continue;
    seen.add(key);
    areaFit.push({ area: key, why: clip(a.why, 300) });
    if (areaFit.length === 3) break;
  }

  let selfScore: SelfScore | null = null;
  if (call.criteria.length > 0) {
    const byKey = new Map(out.selfScore.map((s) => [s.key.trim(), s]));
    const items = call.criteria.map((c) => {
      const s = byKey.get(c.key);
      if (!s) return null;
      const score = Math.max(0, Math.min(c.max, Math.round(Number.isFinite(s.score) ? s.score : 0)));
      return {
        key: c.key,
        label: c.label,
        score,
        max: c.max,
        minToPass: c.minToPass ?? null,
        reason: clip(s.reason, 400),
        improve: clip(s.improve, 400),
      };
    });
    const list = items.filter((i): i is NonNullable<typeof i> => i !== null);
    if (list.length === items.length) {
      const total = list.reduce((a, i) => a + i.score, 0);
      const max = list.reduce((a, i) => a + i.max, 0);
      const perCriterion = list.every((i) => i.minToPass === null || i.score >= i.minToPass);
      selfScore = {
        callId: call.id,
        items: list,
        total,
        max,
        minScore: call.minScore,
        meetsMinimum: perCriterion && (call.minScore === null || total >= call.minScore),
      };
    }
  }
  return { questions, angles, areaFit, selfScore };
}
