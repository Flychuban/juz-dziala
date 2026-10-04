/**
 * Client-safe contracts for modules III (Kreator pomysłów), IV (Tester) and the
 * /network part of V. Zod + shared enums only — the forms import these too, so
 * the browser and the server validate with the same rules and the same Polish
 * messages.
 */
import { z } from "zod";

import {
  authorRoleSchema,
  contactPrefSchema,
  IDEA_STAGES,
  mapaAreaSchema,
  type ContactPref,
} from "~/lib/domain";

export const ideaStageSchema = z.enum(IDEA_STAGES);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What is wrong with a contact for its preference (mirrors createCase), or null. */
export function contactProblemKey(pref: ContactPref, contact: string | undefined): "email" | "phone" | null {
  const c = contact?.trim() ?? "";
  if (pref === "email" && !EMAIL_RE.test(c)) return "email";
  if ((pref === "sms" || pref === "phone") && c.replace(/\D/g, "").length < 9) return "phone";
  return null;
}

/**
 * Polish-message check of a contact against its preference (mirrors createCase).
 * Screens in English use `contactProblemKey` with the `ideas.people.contactError` messages.
 */
export function contactProblem(pref: ContactPref, contact: string | undefined): string | null {
  const k = contactProblemKey(pref, contact);
  if (k === "email") return "Podaj adres e-mail, np. imie@przyklad.pl.";
  if (k === "phone") return "Podaj numer telefonu — 9 cyfr, np. 600 100 200.";
  return null;
}

/** GUS gmina kind („miejska" …) as a message key: urban | rural | mixed. */
export function gminaKindKey(kind: string): "urban" | "rural" | "mixed" | "other" {
  return kind === "miejska" ? "urban" : kind === "wiejska" ? "rural" : kind === "miejsko-wiejska" ? "mixed" : "other";
}

export const gminaTerytSchema = z.string().regex(/^12\d{5}$/, "Wybierz gminę z listy.");

/** Who and how to reach — shared by every resident form in these modules. */
export const contactFieldsSchema = z.object({
  authorRole: authorRoleSchema.default("resident"),
  onBehalf: z.boolean().default(false),
  contactPref: contactPrefSchema.default("none"),
  contact: z.string().trim().max(200).optional(),
  gminaTeryt: gminaTerytSchema.optional(),
});

// ------------------------------------------------------------------ III. the fiszka

export const IDEA_LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 30, max: 4000 },
  targetGroup: { min: 5, max: 1000 },
} as const;

export const ideaCoreSchema = z.object({
  title: z
    .string()
    .trim()
    .min(IDEA_LIMITS.title.min, "Nazwij pomysł — co najmniej 3 znaki.")
    .max(IDEA_LIMITS.title.max, "Nazwa jest za długa — skróć ją do 120 znaków."),
  description: z
    .string()
    .trim()
    .min(IDEA_LIMITS.description.min, "Opisz pomysł w co najmniej dwóch zdaniach (30 znaków).")
    .max(IDEA_LIMITS.description.max, "Opis jest za długi — skróć go do 4000 znaków."),
  targetGroup: z
    .string()
    .trim()
    .min(IDEA_LIMITS.targetGroup.min, "Napisz, komu pomysł ma pomóc.")
    .max(IDEA_LIMITS.targetGroup.max, "Opis grupy jest za długi — skróć go do 1000 znaków."),
  areas: z.array(mapaAreaSchema).max(8).default([]),
  stage: ideaStageSchema,
});
export type IdeaCore = z.infer<typeof ideaCoreSchema>;

/** What the AI assistant may read: the fiszka so far (stage optional). */
export const ideaAssistInputSchema = z.object({
  title: z.string().trim().max(IDEA_LIMITS.title.max).default(""),
  description: z.string().trim().min(IDEA_LIMITS.description.min, "Najpierw opisz pomysł (krok 1).").max(IDEA_LIMITS.description.max),
  targetGroup: z.string().trim().max(IDEA_LIMITS.targetGroup.max).default(""),
  areas: z.array(mapaAreaSchema).max(8).default([]),
  stage: ideaStageSchema.optional(),
});
export type IdeaAssistInput = z.input<typeof ideaAssistInputSchema>;
export type IdeaAssistData = z.infer<typeof ideaAssistInputSchema>;

/** One criterion of the self-assessment, after the server checked and clipped it. */
export type SelfScoreItem = {
  key: string;
  label: string;
  score: number;
  max: number;
  minToPass: number | null;
  reason: string;
  improve: string;
};
export type SelfScore = {
  callId: string;
  items: SelfScoreItem[];
  total: number;
  max: number;
  minScore: number | null;
  /** Total ≥ minScore and every criterion ≥ its own minimum. */
  meetsMinimum: boolean;
};

export const selfScoreSchema = z.object({
  callId: z.string().max(64),
  items: z
    .array(
      z.object({
        key: z.string().max(64),
        label: z.string().max(120),
        score: z.number().int().min(0).max(10),
        max: z.number().int().min(1).max(100),
        minToPass: z.number().int().min(0).max(100).nullable(),
        reason: z.string().max(600),
        improve: z.string().max(600),
      }),
    )
    .max(10),
  total: z.number().int().min(0).max(1000),
  max: z.number().int().min(0).max(1000),
  minScore: z.number().int().nullable(),
  meetsMinimum: z.boolean(),
});

export const ideaSubmitSchema = ideaCoreSchema.extend({
  ...contactFieldsSchema.shape,
  selfScore: selfScoreSchema.optional(),
});
export type IdeaSubmit = z.input<typeof ideaSubmitSchema>;

/** A library card that looks like the idea (keyword match, no AI). */
export type SimilarInnovation = {
  innovationId: string;
  slug: string;
  title: string;
  summary: string;
  authors: string | null;
  normScore: number;
  /** Language of title and summary (English when the card is translated and the reader asked for it). */
  lang?: "pl" | "en";
};

// ------------------------------------------------------------------ III. canvas

/** Values of the interactive Social Innovation Canvas, keyed by canvas.json keys. */
export const canvasValuesSchema = z.object({
  /** "sheet1.problem" → notes; "supporters" → text of a text field. */
  notes: z.record(z.string().max(80), z.string().max(4000)).default({}),
  /** field key (or "impactMatrix.<dimension>") → chosen option labels. */
  picks: z.record(z.string().max(80), z.array(z.string().max(200)).max(20)).default({}),
});
export type CanvasValues = z.infer<typeof canvasValuesSchema>;

// ------------------------------------------------------------------ III. application

export const applicationFieldSchema = z.object({
  key: z.string().max(64),
  label: z.string().max(200),
  value: z.string().max(8000),
});
export type ApplicationField = z.infer<typeof applicationFieldSchema>;

export const GAP = "[DO UZUPEŁNIENIA]";
/** The gap marker of a draft written in English. Both count as gaps everywhere. */
export const GAP_EN = "[TO BE COMPLETED]";
export const gapFor = (locale: string) => (locale === "en" ? GAP_EN : GAP);
export const hasGap = (value: string) => !value.trim() || value.includes(GAP) || value.includes(GAP_EN);

// ------------------------------------------------------------------ IV. tester

export const RATING_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Bardzo słabo",
  2: "Słabo",
  3: "Średnio",
  4: "Dobrze",
  5: "Bardzo dobrze",
};

export const testSignUpSchema = contactFieldsSchema.extend({
  innovationId: z.string().min(1).max(64),
  note: z.string().trim().max(2000).optional(),
});
export type TestSignUp = z.input<typeof testSignUpSchema>;

export const feedbackSchema = contactFieldsSchema.extend({
  innovationId: z.string().min(1).max(64),
  rating: z.number().int().min(1, "Wybierz ocenę od 1 do 5.").max(5, "Wybierz ocenę od 1 do 5."),
  works: z.string().trim().max(2000).default(""),
  improve: z.string().trim().max(2000).default(""),
  suggestion: z.string().trim().max(2000).default(""),
});
export type Feedback = z.input<typeof feedbackSchema>;

// ------------------------------------------------------------------ V. network

export const questionSchema = contactFieldsSchema.extend({
  question: z
    .string()
    .trim()
    .min(15, "Napisz pytanie w co najmniej jednym zdaniu (15 znaków).")
    .max(4000, "Pytanie jest za długie — skróć je do 4000 znaków."),
  area: mapaAreaSchema.optional(),
});
export type Question = z.input<typeof questionSchema>;

export const subscriptionTopicSchema = z.union([
  z.literal("calls"),
  z.templateLiteral(["area:", mapaAreaSchema]),
]);
export type SubscriptionTopic = z.infer<typeof subscriptionTopicSchema>;

export const subscribeSchema = z.object({
  topic: subscriptionTopicSchema,
  channel: z.enum(["email", "sms"]),
  contact: z.string().trim().min(3, "Podaj adres e-mail albo numer telefonu.").max(200),
});
export type Subscribe = z.input<typeof subscribeSchema>;

// ------------------------------------------------------------------ stored payloads (cases.idea)

export const storedApplicationSchema = z.object({
  callId: z.string(),
  callName: z.string(),
  fields: z.array(applicationFieldSchema),
  /** Whether the starting draft came from the assistant or the AI-free template. */
  draftSource: z.enum(["ai", "template", "manual"]),
  submittedAt: z.string(),
});
export type StoredApplication = z.infer<typeof storedApplicationSchema>;

/** `cases.idea` of a kind "idea" case. Text fields are redacted before storage. */
export const storedIdeaSchema = z.object({
  title: z.string(),
  description: z.string(),
  targetGroup: z.string(),
  areas: z.array(mapaAreaSchema).default([]),
  stage: ideaStageSchema.nullable().default(null),
  selfScore: selfScoreSchema.nullable().default(null),
  similar: z
    .array(z.object({ innovationId: z.string(), slug: z.string(), title: z.string() }))
    .default([]),
  application: storedApplicationSchema.nullable().default(null),
});
export type StoredIdea = z.infer<typeof storedIdeaSchema>;
