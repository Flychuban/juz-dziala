/**
 * „Szukam partnera" — a request for a cross-sector partnership, brokered by
 * ROPS. There is no "partnership" case kind, so it is a Sprawa of kind
 * "question" with the title prefix „Partnerstwo: …" and a structured body;
 * ROPS reads it, contacts the other side and answers in the thread. Nobody's
 * contact details are shown. Client-safe (zod + shared enums only).
 */
import { z } from "zod";

import {
  contactPrefSchema,
  type AuthorRole,
} from "~/lib/domain";

export const PARTNER_TYPES = [
  "gmina",
  "ops",
  "ngo",
  "school",
  "social_enterprise",
  "other",
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Who writes, as the case engine records it. */
export const PARTNER_AUTHOR_ROLE: Record<PartnerType, AuthorRole> = {
  gmina: "jst",
  ops: "ops",
  ngo: "ngo",
  school: "other",
  social_enterprise: "other",
  other: "other",
};

export const PARTNER_LIMITS = {
  text: { min: 3, max: 2000 },
  org: { max: 200 },
} as const;

/** Error messages are shown by the form itself; the server repeats the checks. */
export const partnerInputSchema = z.object({
  partnerType: z.enum(PARTNER_TYPES),
  gminaTeryt: z
    .string()
    .regex(/^12\d{5}$/)
    .optional(),
  offer: z
    .string()
    .trim()
    .min(PARTNER_LIMITS.text.min)
    .max(PARTNER_LIMITS.text.max),
  need: z
    .string()
    .trim()
    .min(PARTNER_LIMITS.text.min)
    .max(PARTNER_LIMITS.text.max),
  /** The organisation the author wants to be connected with (from /network or a card). */
  org: z.string().trim().max(PARTNER_LIMITS.org.max).optional(),
  contactPref: contactPrefSchema.default("none"),
  contact: z.string().trim().max(200).optional(),
});
export type PartnerInput = z.input<typeof partnerInputSchema>;

/** Labels in the case's language (the author sees their own request on the case page). */
export type PartnerCaseLabels = {
  /** „Partnerstwo" */
  prefix: string;
  /** „Szukam partnera — prośba o pośrednictwo ROPS." */
  intro: string;
  /** „Kto pisze" */
  who: string;
  /** Name of the partner type in the case's language. */
  typeLabel: string;
  /** „Prośba o kontakt z" */
  org: string;
  /** „Co oferujemy" */
  offer: string;
  /** „Czego szukamy" */
  need: string;
};

/** A short line: the first sentence, cut at a word near `max` characters. */
export function shortLine(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const first = /^(.+?[.?!])(\s|$)/.exec(flat)?.[1] ?? flat;
  if (first.length <= max) return first.replace(/[.]$/, "");
  const cut = first.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Title and body of the Sprawa. */
export function partnershipCase(
  input: {
    offer: string;
    need: string;
    org?: string | null;
  },
  l: PartnerCaseLabels,
): { title: string; body: string } {
  const org = input.org?.trim() ? input.org.trim() : null;
  const title = `${l.prefix}: ${shortLine(org ?? input.need)}`;
  const body = [
    l.intro,
    [`${l.who}: ${l.typeLabel}`, org ? `${l.org}: ${org}` : null]
      .filter(Boolean)
      .join("\n"),
    `${l.offer}:\n${input.offer.trim()}`,
    `${l.need}:\n${input.need.trim()}`,
  ].join("\n\n");
  return { title, body };
}
