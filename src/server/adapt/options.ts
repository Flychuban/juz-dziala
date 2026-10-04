/**
 * Middleman Innowacji — the answers an institution gives before a Ramowy Plan
 * Wdrożenia is generated. Client-safe (zod + shared enums only): the wizard,
 * the route handler and the router all validate against the same schema.
 *
 * Option labels are enum labels (like `labelsFor` in ~/lib/domain): one map
 * per language, read through `optionLabels(locale)`. The Polish maps are also
 * exported under their old names for modules that print a stored plan.
 */
import { z } from "zod";

import type { AuthorRole } from "~/lib/domain";

export type AdaptLocale = "pl" | "en";

export const INSTITUTIONS = [
  "ops",
  "cus",
  "pcpr",
  "ngo",
  "school",
  "other",
] as const;
export type Institution = (typeof INSTITUTIONS)[number];

export const STAFF_RANGES = ["1", "2-3", "4-6", "7+"] as const;
export type StaffRange = (typeof STAFF_RANGES)[number];

export const BUDGET_RANGES = ["to50", "50-200", "200-600", "600+"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

export const TIMEFRAMES = ["6", "12", "24"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type OptionLabels = {
  institution: Record<Institution, string>;
  institutionHint: Record<Institution, string>;
  staff: Record<StaffRange, string>;
  budget: Record<BudgetRange, string>;
  timeframe: Record<Timeframe, string>;
};

const LABELS_PL: OptionLabels = {
  institution: {
    ops: "Ośrodek pomocy społecznej (OPS)",
    cus: "Centrum usług społecznych (CUS)",
    pcpr: "Powiatowe centrum pomocy rodzinie (PCPR)",
    ngo: "Organizacja pozarządowa (NGO)",
    school: "Szkoła lub placówka oświatowa",
    other: "Inna instytucja",
  },
  institutionHint: {
    ops: "Gminny lub miejski ośrodek pomocy społecznej.",
    cus: "Gminne centrum usług społecznych.",
    pcpr: "Jednostka powiatu — wybierz gminę, w której usługa ruszy najpierw.",
    ngo: "Fundacja, stowarzyszenie, spółdzielnia socjalna lub inny podmiot ekonomii społecznej.",
    school: "Szkoła, przedszkole, poradnia lub inna placówka oświatowa.",
    other: "Na przykład dom pomocy społecznej, biblioteka, dom kultury.",
  },
  staff: {
    "1": "1 osoba",
    "2-3": "2–3 osoby",
    "4-6": "4–6 osób",
    "7+": "7 osób lub więcej",
  },
  budget: {
    to50: "do 50 tys. zł",
    "50-200": "50–200 tys. zł",
    "200-600": "200–600 tys. zł",
    "600+": "powyżej 600 tys. zł",
  },
  timeframe: {
    "6": "do 6 miesięcy",
    "12": "12 miesięcy",
    "24": "dłużej niż 12 miesięcy",
  },
};

const LABELS_EN: OptionLabels = {
  institution: {
    ops: "Social welfare centre (OPS)",
    cus: "Social services centre (CUS)",
    pcpr: "County family support centre (PCPR)",
    ngo: "Non-governmental organisation (NGO)",
    school: "School or other educational institution",
    other: "Another institution",
  },
  institutionHint: {
    ops: "A municipal or town social welfare centre.",
    cus: "A municipal social services centre.",
    pcpr: "A county body — choose the municipality where the service will start first.",
    ngo: "A foundation, association, social cooperative or another social economy organisation.",
    school: "A school, nursery school, counselling centre or other educational institution.",
    other: "For example a care home, a library or a community centre.",
  },
  staff: {
    "1": "1 person",
    "2-3": "2–3 people",
    "4-6": "4–6 people",
    "7+": "7 people or more",
  },
  budget: {
    to50: "up to PLN 50,000",
    "50-200": "PLN 50,000–200,000",
    "200-600": "PLN 200,000–600,000",
    "600+": "over PLN 600,000",
  },
  timeframe: {
    "6": "up to 6 months",
    "12": "12 months",
    "24": "longer than 12 months",
  },
};

/** Every option label in one language. */
export function optionLabels(locale: string): OptionLabels {
  return locale === "en" ? LABELS_EN : LABELS_PL;
}

/** Polish maps (stored plans, ROPS case summaries). Screens use `optionLabels`. */
export const INSTITUTION_LABEL = LABELS_PL.institution;
export const INSTITUTION_HINT = LABELS_PL.institutionHint;
export const STAFF_LABEL = LABELS_PL.staff;
export const BUDGET_LABEL = LABELS_PL.budget;
export const TIMEFRAME_LABEL = LABELS_PL.timeframe;

/** How the Sprawa engine files the author of an adaptation request. */
export const INSTITUTION_AUTHOR_ROLE: Record<Institution, AuthorRole> = {
  ops: "ops",
  cus: "ops",
  pcpr: "ops",
  ngo: "ngo",
  school: "other",
  other: "other",
};

/** Bounds of each budget answer in zł; `max: null` = open-ended. */
export const BUDGET_BOUNDS: Record<
  BudgetRange,
  { min: number; max: number | null }
> = {
  to50: { min: 0, max: 50_000 },
  "50-200": { min: 50_000, max: 200_000 },
  "200-600": { min: 200_000, max: 600_000 },
  "600+": { min: 600_000, max: null },
};

export const MAX_NEEDS_CHARS = 1000;

/**
 * Validation messages are keys of `adapt.validation` (messages/{pl,en}/adapt.json):
 * whoever shows one to a person translates it.
 */
export const planInputSchema = z.object({
  innovationId: z.string().trim().min(1).max(64),
  institution: z.enum(INSTITUTIONS, "institution"),
  gminaTeryt: z
    .string()
    .trim()
    .regex(/^12\d{5}$/, "gmina"),
  staff: z.enum(STAFF_RANGES, "staff"),
  budget: z.enum(BUDGET_RANGES, "budget"),
  timeframe: z.enum(TIMEFRAMES, "timeframe"),
  groupSize: z
    .number()
    .int("groupSizeInteger")
    .min(1, "groupSizeMin")
    .max(1_000_000, "groupSizeMax")
    .nullish(),
  needs: z.string().trim().max(MAX_NEEDS_CHARS, "needsLength").nullish(),
});
export type PlanInputs = z.infer<typeof planInputSchema>;

export const VALIDATION_KEYS = [
  "institution",
  "gmina",
  "staff",
  "budget",
  "timeframe",
  "groupSizeInteger",
  "groupSizeMin",
  "groupSizeMax",
  "needsLength",
  "email",
  "planTooShort",
  "planTooLong",
] as const;
export type ValidationKey = (typeof VALIDATION_KEYS)[number];
export function isValidationKey(v: unknown): v is ValidationKey {
  return (VALIDATION_KEYS as readonly unknown[]).includes(v);
}

/**
 * Who wrote the plan that reached the reader:
 *  - "ai": the Asystent AI wrote every narrative section;
 *  - "mixed": it wrote some, the template filled the rest (slow model, error);
 *  - "template": no AI at all.
 * Scale, budget and funding are computed by the server in every mode.
 */
export type PlanSource = "ai" | "mixed" | "template";
/** The source of a finished plan (older name). */
export type PlanMode = PlanSource;
export const PLAN_SOURCES = ["ai", "mixed", "template"] as const;
export function isPlanSource(v: unknown): v is PlanSource {
  return v === "ai" || v === "mixed" || v === "template";
}

/**
 * Response header of /api/adapt/plan: "template" when no AI is attempted,
 * "ai" when the model is asked. The FINAL source of an AI attempt is known
 * only at the end, so that body ends with `planSourceMarker(source)`.
 */
export const PLAN_MODE_HEADER = "x-plan-mode";
const MARKER = /\n?<!-- plan-source: (ai|mixed|template) -->\s*$/;
export function planSourceMarker(source: PlanSource): string {
  return `\n<!-- plan-source: ${source} -->\n`;
}
/** Splits a (possibly still streaming) body into the plan and its final source. */
export function readPlanSource(body: string): {
  markdown: string;
  source: PlanSource | null;
} {
  const m = MARKER.exec(body);
  if (m) return { markdown: body.slice(0, m.index), source: m[1] as PlanSource };
  // A marker still arriving („<!-- plan-sou") never reaches the screen.
  const partial = body.lastIndexOf("\n<!--");
  if (partial >= 0 && !body.slice(partial).includes("-->")) {
    return { markdown: body.slice(0, partial), source: null };
  }
  return { markdown: body, source: null };
}
