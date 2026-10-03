/**
 * Middleman Innowacji — the answers an institution gives before a Ramowy Plan
 * Wdrożenia is generated. Client-safe (zod + shared enums only): the wizard,
 * the route handler and the router all validate against the same schema.
 */
import { z } from "zod";

import type { AuthorRole } from "~/lib/domain";

export const INSTITUTIONS = [
  "ops",
  "cus",
  "pcpr",
  "ngo",
  "school",
  "other",
] as const;
export type Institution = (typeof INSTITUTIONS)[number];
export const INSTITUTION_LABEL: Record<Institution, string> = {
  ops: "Ośrodek pomocy społecznej (OPS)",
  cus: "Centrum usług społecznych (CUS)",
  pcpr: "Powiatowe centrum pomocy rodzinie (PCPR)",
  ngo: "Organizacja pozarządowa (NGO)",
  school: "Szkoła lub placówka oświatowa",
  other: "Inna instytucja",
};
export const INSTITUTION_HINT: Record<Institution, string> = {
  ops: "Gminny lub miejski ośrodek pomocy społecznej.",
  cus: "Gminne centrum usług społecznych.",
  pcpr: "Jednostka powiatu — wybierz gminę, w której usługa ruszy najpierw.",
  ngo: "Fundacja, stowarzyszenie, spółdzielnia socjalna lub inny podmiot ekonomii społecznej.",
  school: "Szkoła, przedszkole, poradnia lub inna placówka oświatowa.",
  other: "Na przykład dom pomocy społecznej, biblioteka, dom kultury.",
};
/** How the Sprawa engine files the author of an adaptation request. */
export const INSTITUTION_AUTHOR_ROLE: Record<Institution, AuthorRole> = {
  ops: "ops",
  cus: "ops",
  pcpr: "ops",
  ngo: "ngo",
  school: "other",
  other: "other",
};

export const STAFF_RANGES = ["1", "2-3", "4-6", "7+"] as const;
export type StaffRange = (typeof STAFF_RANGES)[number];
export const STAFF_LABEL: Record<StaffRange, string> = {
  "1": "1 osoba",
  "2-3": "2–3 osoby",
  "4-6": "4–6 osób",
  "7+": "7 osób lub więcej",
};

export const BUDGET_RANGES = ["to50", "50-200", "200-600", "600+"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];
export const BUDGET_LABEL: Record<BudgetRange, string> = {
  to50: "do 50 tys. zł",
  "50-200": "50–200 tys. zł",
  "200-600": "200–600 tys. zł",
  "600+": "powyżej 600 tys. zł",
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

export const TIMEFRAMES = ["6", "12", "24"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "6": "do 6 miesięcy",
  "12": "12 miesięcy",
  "24": "dłużej niż 12 miesięcy",
};

export const MAX_NEEDS_CHARS = 1000;

export const planInputSchema = z.object({
  innovationId: z.string().trim().min(1).max(64),
  institution: z.enum(INSTITUTIONS, "Wybierz rodzaj instytucji."),
  gminaTeryt: z
    .string()
    .trim()
    .regex(/^12\d{5}$/, "Wybierz gminę z listy."),
  staff: z.enum(STAFF_RANGES, "Wybierz, ile osób może pracować przy usłudze."),
  budget: z.enum(BUDGET_RANGES, "Wybierz orientacyjny budżet."),
  timeframe: z.enum(TIMEFRAMES, "Wybierz czas realizacji."),
  groupSize: z
    .number()
    .int("Podaj liczbę osób bez części dziesiętnych.")
    .min(1, "Liczba osób musi być większa od zera.")
    .max(1_000_000, "Ta liczba jest za duża.")
    .nullish(),
  needs: z
    .string()
    .trim()
    .max(
      MAX_NEEDS_CHARS,
      `Skróć opis do ${MAX_NEEDS_CHARS} znaków.`,
    )
    .nullish(),
});
export type PlanInputs = z.infer<typeof planInputSchema>;

/** Which kind of plan reached the reader. */
export type PlanMode = "ai" | "template";
export const PLAN_MODE_HEADER = "x-plan-mode";

export const PLAN_DISCLAIMER =
  "Projekt planu przygotowany automatycznie — wymaga weryfikacji przez specjalistę ROPS";
export const RAMOWY_PLAN_BADGE =
  "ROPS ma już Ramowy Plan Wdrożenia tej innowacji (Usługa Wrażliwa)";
