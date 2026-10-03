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
