/**
 * Input contract of `createCase` — shared by every module that opens a Sprawa
 * (needs, ideas, questions, test sign-ups, feedback, adaptation requests).
 * Client-safe: zod + shared enums only. Error messages are Polish because
 * they reach the form.
 */
import { z } from "zod";

import {
  authorRoleSchema,
  caseKindSchema,
  contactPrefSchema,
  mapaAreaSchema,
} from "~/lib/domain";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Digits only, optional leading +; Polish numbers are 9 digits. */
export function normalizePhone(s: string): string | null {
  const plus = s.trim().startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return (plus ? "+" : "") + digits;
}

export const createCaseInputSchema = z
  .object({
    kind: caseKindSchema,
    title: z
      .string()
      .trim()
      .min(3, "Tytuł jest za krótki — napisz co najmniej 3 znaki.")
      .max(200, "Tytuł jest za długi — skróć go do 200 znaków."),
    body: z
      .string()
      .trim()
      .min(10, "Opis jest za krótki — napisz co najmniej jedno zdanie.")
      .max(8000, "Opis jest za długi — skróć go do 8000 znaków."),
    gminaTeryt: z.string().trim().max(20).optional(),
    powiatTeryt: z.string().trim().max(20).optional(),
    areas: z.array(mapaAreaSchema).max(8).optional(),
    authorRole: authorRoleSchema.default("resident"),
    onBehalf: z.boolean().default(false),
    contactPref: contactPrefSchema.default("none"),
    contact: z.string().trim().max(200).optional(),
    matchRunId: z.uuid().optional(),
    innovationId: z.string().max(64).optional(),
    callId: z.string().max(64).optional(),
    idea: z.unknown().optional(),
    canvas: z.unknown().optional(),
    plan: z.unknown().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    isSample: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.contactPref === "email") {
      if (!v.contact || !EMAIL_RE.test(v.contact)) {
        ctx.addIssue({
          code: "custom",
          path: ["contact"],
          message: "Podaj adres e-mail, np. imie@przyklad.pl.",
        });
      }
    }
    if (v.contactPref === "sms" || v.contactPref === "phone") {
      if (!v.contact || !normalizePhone(v.contact)) {
        ctx.addIssue({
          code: "custom",
          path: ["contact"],
          message: "Podaj numer telefonu — 9 cyfr, np. 600 100 200.",
        });
      }
    }
  });

export type CreateCaseInput = z.input<typeof createCaseInputSchema>;
