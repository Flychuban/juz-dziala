/**
 * Shared domain vocabulary — the contract between every module.
 * Client-safe (no server imports). Polish labels live here so every screen
 * names things the same way.
 */
import { z } from "zod";

/** The 8 areas of ROPS's „Mapa Wyzwań Społecznych" (Nov 2024). */
export const MAPA_AREAS = [
  "family",
  "homelessness",
  "disability",
  "poverty",
  "migrants",
  "health",
  "mental_health",
  "seniors",
] as const;
export const mapaAreaSchema = z.enum(MAPA_AREAS);
export type MapaArea = z.infer<typeof mapaAreaSchema>;

export const MAPA_AREA_LABEL: Record<MapaArea, string> = {
  family: "Rodzina i piecza zastępcza",
  homelessness: "Bezdomność",
  disability: "Niepełnosprawność",
  poverty: "Ubóstwo",
  migrants: "Integracja cudzoziemców",
  health: "Zdrowie",
  mental_health: "Zdrowie psychiczne",
  seniors: "Seniorzy",
};

/** Library card sections, in the order ROPS prints them. */
export const SECTION_KEYS = [
  "solution",
  "problems",
  "targetGroup",
  "whoCanUse",
  "doesItWork",
  "authors",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_LABEL: Record<SectionKey, string> = {
  solution: "Na czym polega rozwiązanie?",
  problems: "Jakich problemów dotyczy innowacja?",
  targetGroup: "Grupa docelowa",
  whoCanUse: "Kto może skorzystać z innowacji?",
  doesItWork: "Czy to działa?",
  authors: "Autorzy",
};

export const INNOVATION_STATUS = ["draft", "verified", "published"] as const;
export type InnovationStatus = (typeof INNOVATION_STATUS)[number];
export const INNOVATION_STATUS_LABEL: Record<InnovationStatus, string> = {
  draft: "Szkic",
  verified: "Sprawdzona",
  published: "Opublikowana",
};

/** One engine for every module: each of these is a „Sprawa". */
export const CASE_KINDS = [
  "need",
  "idea",
  "question",
  "test",
  "feedback",
  "adapt",
] as const;
export const caseKindSchema = z.enum(CASE_KINDS);
export type CaseKind = z.infer<typeof caseKindSchema>;
export const CASE_KIND_LABEL: Record<CaseKind, string> = {
  need: "Potrzeba",
  idea: "Pomysł",
  question: "Pytanie do eksperta",
  test: "Zgłoszenie do testów",
  feedback: "Opinia o innowacji",
  adapt: "Wdrożenie usługi",
};

export const CASE_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "answered",
  "closed",
] as const;
export const caseStatusSchema = z.enum(CASE_STATUSES);
export type CaseStatus = z.infer<typeof caseStatusSchema>;
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  new: "Nowa",
  triaged: "Wstępnie oceniona",
  in_progress: "W toku",
  answered: "Odpowiedziano",
  closed: "Zamknięta",
};

export const URGENCIES = ["low", "medium", "high"] as const;
export const urgencySchema = z.enum(URGENCIES);
export type Urgency = z.infer<typeof urgencySchema>;
export const URGENCY_LABEL: Record<Urgency, string> = {
  low: "Niska",
  medium: "Średnia",
  high: "Wysoka",
};

export const CONTACT_PREFS = ["email", "sms", "phone", "none"] as const;
export const contactPrefSchema = z.enum(CONTACT_PREFS);
export type ContactPref = z.infer<typeof contactPrefSchema>;
export const CONTACT_PREF_LABEL: Record<ContactPref, string> = {
  email: "E-mail",
  sms: "SMS",
  phone: "Telefon — zadzwońcie do mnie",
  none: "Sprawdzę sam(a) kodem sprawy",
};

export const AUTHOR_ROLES = ["resident", "ngo", "jst", "ops", "other"] as const;
export const authorRoleSchema = z.enum(AUTHOR_ROLES);
export type AuthorRole = z.infer<typeof authorRoleSchema>;
export const AUTHOR_ROLE_LABEL: Record<AuthorRole, string> = {
  resident: "Mieszkaniec / mieszkanka",
  ngo: "Organizacja pozarządowa",
  jst: "Gmina / powiat",
  ops: "OPS / CUS / PCPR",
  other: "Inna instytucja",
};

/** Staff roles. Residents never need an account. */
export const STAFF_ROLES = ["rops", "expert", "jst"] as const;
export const staffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof staffRoleSchema>;
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  rops: "Pracownik ROPS",
  expert: "Ekspert / mentor",
  jst: "Gmina",
};

export const MESSAGE_AUTHOR_KINDS = [
  "author",
  "rops",
  "expert",
  "system",
] as const;
export type MessageAuthorKind = (typeof MESSAGE_AUTHOR_KINDS)[number];

export const CALL_STATUSES = ["planned", "open", "closed", "demo"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  planned: "Planowany",
  open: "Otwarty",
  closed: "Zakończony",
  demo: "Nabór przykładowy (demo)",
};

/** Idea maturity — the Canvas „Gotowość do wdrożenia" scale. */
export const IDEA_STAGES = ["idea", "prototype", "tested", "ready"] as const;
export type IdeaStage = (typeof IDEA_STAGES)[number];
export const IDEA_STAGE_LABEL: Record<IdeaStage, string> = {
  idea: "Pomysł",
  prototype: "Prototyp",
  tested: "Przetestowane",
  ready: "Gotowe do wdrożenia",
};

/** Public site name and ownership line. */
export const SITE = {
  name: "Już Działa",
  tagline:
    "Twój problem ktoś w Małopolsce już rozwiązał. Pokażemy Ci kto — i połączymy Was.",
  owner: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
  ownerShort: "ROPS Kraków",
  ownerLine: "Instytucja Województwa Małopolskiego",
  hub: "Małopolski Hub Innowacji Społecznych",
} as const;

/* ───────────────────────── English labels ─────────────────────────
 * Same keys as the Polish maps above. Screens read labels through
 * `labelsFor(locale)` (async server components) or `useLabels()` (from
 * "~/i18n/use-labels", client and non-async server components), never the
 * Polish maps directly.
 */
export const MAPA_AREA_LABEL_EN: Record<MapaArea, string> = {
  family: "Family and foster care",
  homelessness: "Homelessness",
  disability: "Disability",
  poverty: "Poverty",
  migrants: "Integration of foreigners",
  health: "Health",
  mental_health: "Mental health",
  seniors: "Older people",
};
export const SECTION_LABEL_EN: Record<SectionKey, string> = {
  solution: "What is the solution?",
  problems: "Which problems does it address?",
  targetGroup: "Target group",
  whoCanUse: "Who can use it?",
  doesItWork: "Does it work?",
  authors: "Authors",
};
export const INNOVATION_STATUS_LABEL_EN: Record<InnovationStatus, string> = {
  draft: "Draft",
  verified: "Checked",
  published: "Published",
};
export const CASE_KIND_LABEL_EN: Record<CaseKind, string> = {
  need: "Need",
  idea: "Idea",
  question: "Question for an expert",
  test: "Testing sign-up",
  feedback: "Feedback on an innovation",
  adapt: "Service implementation",
};
export const CASE_STATUS_LABEL_EN: Record<CaseStatus, string> = {
  new: "New",
  triaged: "Assessed",
  in_progress: "In progress",
  answered: "Answered",
  closed: "Closed",
};
export const URGENCY_LABEL_EN: Record<Urgency, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
export const CONTACT_PREF_LABEL_EN: Record<ContactPref, string> = {
  email: "E-mail",
  sms: "Text message (SMS)",
  phone: "Phone — please call me",
  none: "I'll check myself with my case code",
};
export const AUTHOR_ROLE_LABEL_EN: Record<AuthorRole, string> = {
  resident: "Resident",
  ngo: "Non-governmental organisation",
  jst: "Municipality / county",
  ops: "Social welfare centre (OPS / CUS / PCPR)",
  other: "Other institution",
};
export const STAFF_ROLE_LABEL_EN: Record<StaffRole, string> = {
  rops: "ROPS staff member",
  expert: "Expert / mentor",
  jst: "Municipality",
};
export const CALL_STATUS_LABEL_EN: Record<CallStatus, string> = {
  planned: "Planned",
  open: "Open",
  closed: "Closed",
  demo: "Sample call (demo)",
};
export const IDEA_STAGE_LABEL_EN: Record<IdeaStage, string> = {
  idea: "Idea",
  prototype: "Prototype",
  tested: "Tested",
  ready: "Ready to implement",
};
export const SITE_EN = {
  name: "Już Działa",
  tagline:
    "Someone in Małopolska has already solved your problem. We'll show you who — and connect you.",
  owner: "Regional Social Policy Centre in Kraków (ROPS)",
  ownerShort: "ROPS Kraków",
  ownerLine: "An institution of the Małopolska Region",
  hub: "Małopolska Social Innovation Hub",
} as const;

const LABELS_PL = {
  area: MAPA_AREA_LABEL,
  section: SECTION_LABEL,
  innovationStatus: INNOVATION_STATUS_LABEL,
  caseKind: CASE_KIND_LABEL,
  caseStatus: CASE_STATUS_LABEL,
  urgency: URGENCY_LABEL,
  contactPref: CONTACT_PREF_LABEL,
  authorRole: AUTHOR_ROLE_LABEL,
  staffRole: STAFF_ROLE_LABEL,
  callStatus: CALL_STATUS_LABEL,
  ideaStage: IDEA_STAGE_LABEL,
  site: SITE as { [K in keyof typeof SITE]: string },
};
export type Labels = typeof LABELS_PL;
const LABELS_EN: Labels = {
  area: MAPA_AREA_LABEL_EN,
  section: SECTION_LABEL_EN,
  innovationStatus: INNOVATION_STATUS_LABEL_EN,
  caseKind: CASE_KIND_LABEL_EN,
  caseStatus: CASE_STATUS_LABEL_EN,
  urgency: URGENCY_LABEL_EN,
  contactPref: CONTACT_PREF_LABEL_EN,
  authorRole: AUTHOR_ROLE_LABEL_EN,
  staffRole: STAFF_ROLE_LABEL_EN,
  callStatus: CALL_STATUS_LABEL_EN,
  ideaStage: IDEA_STAGE_LABEL_EN,
  site: SITE_EN,
};

/** Every label map in one language. `locale` is "pl" | "en" (see ~/i18n/config). */
export function labelsFor(locale: string): Labels {
  return locale === "en" ? LABELS_EN : LABELS_PL;
}
