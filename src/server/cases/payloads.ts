import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
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
import { caseLocale } from "./author-text";
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
  /** Who wrote the plan: "ai", "mixed" (AI + template) or "template". */
  mode: z.string().optional(),
  /** The language the plan was written in (newer plans); else the case's. */
  locale: z.enum(["pl", "en"]).optional(),
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

/** Keys of the plan's detail rows; the UI names them (messages `cases.modules.plan.detail.*`). */
export type PlanDetailKey =
  | "innovation"
  | "gmina"
  | "institution"
  | "staff"
  | "budget"
  | "timeframe"
  | "groupSize"
  | "needs";

export type PlanMode = "ai" | "mixed" | "template";

export type PlanPayload = {
  markdown: string;
  /** The plan's language: its own `locale`, else the case's. Labels below use it. */
  locale: Locale;
  /** Who wrote the plan: with the AI assistant, partly, or from the template. */
  mode: PlanMode | null;
  /** `mode` in words, in the plan's language („z pomocą Asystenta AI"…). */
  modeLabel: string | null;
  /**
   * Answers in the plan's language. `option` is the raw answer (e.g. "ops",
   * "50-200") for code that needs it; free text is shown as stored.
   */
  details: { key: PlanDetailKey; value: string; option?: string }[];
  ramowyPlan: { callName: string; sourceUrl: string | null } | null;
  submittedAt: string | null;
};

const planModeOf = (v?: string): PlanMode | null =>
  v === "ai" || v === "mixed" || v === "template" ? v : v ? "template" : null;

/** An answer code named in `locale` (messages), else the stored Polish label. */
function optionValue<K extends string>(
  locale: Locale,
  key: "institution" | "staff" | "budget" | "timeframe",
  polish: Record<K, string>,
  v?: string,
): { value: string; option: string } | null {
  if (!v || !(v in polish)) return null;
  const t = translatorFor(locale, "cases");
  const path = `modules.plan.option.${key}.${v}` as never;
  return { value: t.has(path) ? t(path) : polish[v as K], option: v };
}

function planPayload(raw: unknown, fallbackLocale: Locale): PlanPayload | null {
  const p = storedPlanSchema.safeParse(raw);
  if (!p.success) return null;
  const d = p.data;
  const i = d.inputs ?? {};
  const locale = d.locale ?? fallbackLocale;
  const text = (key: PlanDetailKey, value?: string | null) =>
    value ? { key, value } : null;
  const option = (
    key: "institution" | "staff" | "budget" | "timeframe",
    found: { value: string; option: string } | null,
  ) => (found ? { key, ...found } : null);
  const rows = [
    text("innovation", d.innovationTitle),
    text("gmina", d.gminaName),
    option(
      "institution",
      optionValue<Institution>(locale, "institution", INSTITUTION_LABEL, i.institution),
    ),
    option("staff", optionValue<StaffRange>(locale, "staff", STAFF_LABEL, i.staff)),
    option("budget", optionValue<BudgetRange>(locale, "budget", BUDGET_LABEL, i.budget)),
    option(
      "timeframe",
      optionValue<Timeframe>(locale, "timeframe", TIMEFRAME_LABEL, i.timeframe),
    ),
    text("groupSize", i.groupSize != null ? String(i.groupSize) : null),
    text("needs", i.needs),
  ];
  const mode = planModeOf(d.mode);
  return {
    markdown: d.markdown,
    locale,
    mode,
    modeLabel: mode
      ? translatorFor(locale, "cases")(`modules.plan.mode.${mode}`)
      : null,
    details: rows.filter((r): r is NonNullable<typeof r> => r !== null),
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
    /** In the reader's language when the card has a translation. */
    title: string;
    /** Language of `title` (wrap in lang="pl" when it differs from the page). */
    titleLang: "pl" | "en";
    sourceUrl: string;
    capturedAt: Date;
  } | null;
  call: { id: string; name: string } | null;
  rating: number | null;
};

export async function casePayloads(
  c: CaseRow,
  /**
   * Staff also get the filled Canvas and the submitted application fields.
   * `locale` is the reader's language (default "pl").
   */
  opts: { staff: boolean; locale?: "pl" | "en" },
): Promise<CasePayloads> {
  const english = opts.locale === "en";
  const [idea, innovation, call] = await Promise.all([
    c.kind === "idea" ? ideaPayload(c, opts.staff) : null,
    c.innovationId
      ? db
          .select({
            id: innovations.id,
            slug: innovations.slug,
            title: innovations.title,
            en: innovations.en,
            sourceUrl: innovations.sourceUrl,
            capturedAt: innovations.capturedAt,
          })
          .from(innovations)
          .where(eq(innovations.id, c.innovationId))
          .then((r) => {
            const row = r[0];
            if (!row) return null;
            const { en, ...rest } = row;
            return english && en?.title
              ? { ...rest, title: en.title, titleLang: "en" as const }
              : { ...rest, titleLang: "pl" as const };
          })
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
    plan: c.kind === "adapt" ? planPayload(c.plan, caseLocale(c.locale)) : null,
    idea,
    innovation,
    call,
    rating: c.rating,
  };
}
