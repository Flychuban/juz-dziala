/**
 * The plan an institution sent to ROPS (`jd_case.plan` of an „adapt" case),
 * read defensively — a payload that does not parse is shown as absent, never
 * guessed at — and its details labelled in the reader's language.
 */
import { z } from "zod";

import type { Locale } from "~/i18n/config";
import { adaptT } from "./i18n";
import {
  BUDGET_RANGES,
  INSTITUTIONS,
  isPlanSource,
  optionLabels,
  STAFF_RANGES,
  TIMEFRAMES,
  type PlanSource,
} from "./options";

const storedPlanSchema = z.object({
  markdown: z.string().min(1),
  mode: z.string().optional(),
  /** The language the plan was written in (absent on older plans: Polish). */
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
  submittedAt: z.string().optional(),
});

export type StoredPlan = {
  markdown: string;
  source: PlanSource | null;
  /** Language of `markdown` and of the titles the institution saw. */
  locale: Locale;
  details: { label: string; value: string }[];
  submittedAt: string | null;
};

function pick<K extends string>(
  keys: readonly K[],
  labels: Record<K, string>,
  v: string | undefined,
): string | null {
  return v && (keys as readonly string[]).includes(v) ? labels[v as K] : null;
}

/** The stored plan with its details labelled for a reader in `locale`. */
export function readStoredPlan(raw: unknown, locale: Locale): StoredPlan | null {
  const p = storedPlanSchema.safeParse(raw);
  if (!p.success) return null;
  const d = p.data;
  const i = d.inputs ?? {};
  const t = adaptT(locale);
  const o = optionLabels(locale);
  const rows: [string, string | null | undefined][] = [
    [t("casePlan.details.innovation"), d.innovationTitle],
    [t("casePlan.details.gmina"), d.gminaName],
    [t("casePlan.details.institution"), pick(INSTITUTIONS, o.institution, i.institution)],
    [t("casePlan.details.staff"), pick(STAFF_RANGES, o.staff, i.staff)],
    [t("casePlan.details.budget"), pick(BUDGET_RANGES, o.budget, i.budget)],
    [t("casePlan.details.timeframe"), pick(TIMEFRAMES, o.timeframe, i.timeframe)],
    [
      t("casePlan.details.groupSize"),
      i.groupSize != null ? String(i.groupSize) : null,
    ],
    [t("casePlan.details.needs"), i.needs],
  ];
  return {
    markdown: d.markdown,
    source: isPlanSource(d.mode) ? d.mode : null,
    locale: d.locale ?? "pl",
    details: rows.flatMap(([label, value]) => (value ? [{ label, value }] : [])),
    submittedAt: d.submittedAt ?? null,
  };
}
