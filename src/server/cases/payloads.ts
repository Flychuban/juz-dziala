import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { MapaArea, IdeaStage } from "~/lib/domain";
import {
  BUDGET_LABEL,
  INSTITUTION_LABEL,
  STAFF_LABEL,
  TIMEFRAME_LABEL,
  type BudgetRange,
  type Institution,
  type StaffRange,
  type Timeframe,
} from "~/server/adapt/options";
import { db } from "~/server/db";
import { calls, innovations } from "~/server/db/schema";
import { IMPACT_DIMENSIONS, notesKey } from "~/server/ideas/canvas-def";
import { loadCanvasDef } from "~/server/ideas/data";
import {
  canvasValuesSchema,
  storedIdeaSchema,
  type SelfScore,
} from "~/server/ideas/schema";
import type { CaseRow } from "./queries";

/**
 * The module payloads of a Sprawa, read defensively and shaped for display:
 * the Ramowy Plan Wdrożenia (adapt), the fiszka + IWS self-score (+ Canvas)
 * of an idea, the innovation a test/feedback is about, and the call an
 * application went to. The owning modules write these; a payload that does not
 * parse is shown as absent, never guessed at.
 */

const storedPlanSchema = z.object({
  markdown: z.string().min(1),
  mode: z.string().optional(),
  inputs: z
    .object({
      institution: z.string().optional(),
      staff: z.string().optional(),
      budget: z.string().optional(),
      timeframe: z.string().optional(),
      groupSize: z.number().nullable().optional(),
      needs: z.string().nullable().optional(),
    })
    .partial()
    .optional(),
  innovationTitle: z.string().optional(),
  gminaName: z.string().optional(),
  ramowyPlan: z
    .object({
      callId: z.string(),
      callName: z.string(),
      sourceUrl: z.string().nullable(),
    })
    .nullable()
    .optional(),
  submittedAt: z.string().optional(),
});

export type PlanPayload = {
  markdown: string;
  /** „Asystent AI" or „szablon (bez AI)". */
  modeLabel: string | null;
  details: { label: string; value: string }[];
  ramowyPlan: { callName: string; sourceUrl: string | null } | null;
  submittedAt: string | null;
};

const label = <K extends string>(map: Record<K, string>, v?: string) =>
  v && v in map ? map[v as K] : null;

function planPayload(raw: unknown): PlanPayload | null {
  const p = storedPlanSchema.safeParse(raw);
  if (!p.success) return null;
  const d = p.data;
  const i = d.inputs ?? {};
  const rows: [string, string | null | undefined][] = [
    ["Innowacja", d.innovationTitle],
    ["Gmina", d.gminaName],
    ["Instytucja", label<Institution>(INSTITUTION_LABEL, i.institution)],
    ["Zespół", label<StaffRange>(STAFF_LABEL, i.staff)],
    ["Budżet (do weryfikacji)", label<BudgetRange>(BUDGET_LABEL, i.budget)],
    ["Czas realizacji", label<Timeframe>(TIMEFRAME_LABEL, i.timeframe)],
    [
      "Planowana liczba odbiorców",
      i.groupSize != null ? String(i.groupSize) : null,
    ],
    ["Potrzeby instytucji", i.needs],
  ];
  return {
    markdown: d.markdown,
    modeLabel:
      d.mode === "ai"
        ? "z pomocą Asystenta AI"
        : d.mode
          ? "z szablonu (bez AI)"
          : null,
    details: rows.flatMap(([l, v]) => (v ? [{ label: l, value: v }] : [])),
    ramowyPlan: d.ramowyPlan
      ? {
          callName: d.ramowyPlan.callName,
          sourceUrl: d.ramowyPlan.sourceUrl,
        }
      : null,
    submittedAt: d.submittedAt ?? null,
  };
}

export type CanvasSectionView = {
  sheet: string;
  section: string;
  lines: string[];
};

export type IdeaPayload = {
  title: string;
  description: string;
  targetGroup: string;
  areas: MapaArea[];
  stage: IdeaStage | null;
  selfScore: SelfScore | null;
  similar: { innovationId: string; slug: string; title: string }[];
  application: {
    callId: string;
    callName: string;
    submittedAt: string;
    draftSource: "ai" | "template" | "manual";
    /** The submitted form fields (staff view only). */
    fields: { key: string; label: string; value: string }[] | null;
  } | null;
  hasCanvas: boolean;
  /** Filled Canvas sections (staff view only). */
  canvas: CanvasSectionView[] | null;
};

async function canvasSections(
  raw: unknown,
): Promise<CanvasSectionView[] | null> {
  const v = canvasValuesSchema.safeParse(raw);
  if (!v.success) return null;
  const def = await loadCanvasDef();
  if (!def) return null;
  const out: CanvasSectionView[] = [];
  for (const sheet of def.sheets) {
    for (const section of sheet.sections) {
      const lines: string[] = [];
      const note = v.data.notes[notesKey(sheet.key, section.key)];
      if (note) lines.push(note);
      for (const f of section.fields) {
        if (f.kind === "text" && v.data.notes[f.key])
          lines.push(`${f.label}: ${v.data.notes[f.key]}`);
        if (
          (f.kind === "single" || f.kind === "multi") &&
          v.data.picks[f.key]?.length
        )
          lines.push(`${f.label}: ${v.data.picks[f.key]!.join(", ")}`);
        if (f.kind === "matrix") {
          for (const dim of IMPACT_DIMENSIONS) {
            const picks = v.data.picks[`${f.key}.${dim}`];
            if (picks?.length)
              lines.push(`Wpływ — ${dim}: ${picks.join(", ")}`);
          }
        }
      }
      if (lines.length)
        out.push({ sheet: sheet.title, section: section.label, lines });
    }
  }
  return out;
}

async function ideaPayload(
  c: CaseRow,
  staff: boolean,
): Promise<IdeaPayload | null> {
  const p = storedIdeaSchema.safeParse(c.idea);
  if (!p.success) return null;
  const d = p.data;
  return {
    title: d.title,
    description: d.description,
    targetGroup: d.targetGroup,
    areas: d.areas,
    stage: d.stage,
    selfScore: d.selfScore,
    similar: d.similar,
    application: d.application
      ? {
          callId: d.application.callId,
          callName: d.application.callName,
          submittedAt: d.application.submittedAt,
          draftSource: d.application.draftSource,
          fields: staff ? d.application.fields : null,
        }
      : null,
    hasCanvas: c.canvas != null,
    canvas: staff && c.canvas != null ? await canvasSections(c.canvas) : null,
  };
}

export type CasePayloads = {
  plan: PlanPayload | null;
  idea: IdeaPayload | null;
  innovation: {
    id: string;
    slug: string;
    title: string;
    sourceUrl: string;
    capturedAt: Date;
  } | null;
  call: { id: string; name: string } | null;
  rating: number | null;
};

export async function casePayloads(
  c: CaseRow,
  /** Staff also get the filled Canvas and the submitted application fields. */
  opts: { staff: boolean },
): Promise<CasePayloads> {
  const [idea, innovation, call] = await Promise.all([
    c.kind === "idea" ? ideaPayload(c, opts.staff) : null,
    c.innovationId
      ? db
          .select({
            id: innovations.id,
            slug: innovations.slug,
            title: innovations.title,
            sourceUrl: innovations.sourceUrl,
            capturedAt: innovations.capturedAt,
          })
          .from(innovations)
          .where(eq(innovations.id, c.innovationId))
          .then((r) => r[0] ?? null)
      : null,
    c.callId
      ? db
          .select({ id: calls.id, name: calls.name })
          .from(calls)
          .where(eq(calls.id, c.callId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  return {
    plan: c.kind === "adapt" ? planPayload(c.plan) : null,
    idea,
    innovation,
    call,
    rating: c.rating,
  };
}
