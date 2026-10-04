/** Shapes stored in jsonb by the Sprawa engine. Client-safe. */
import {
  CASE_KIND_LABEL,
  type CaseKind,
  type CaseStatus,
  type MapaArea,
  type Urgency,
} from "~/lib/domain";

export type TriageCard = {
  id: string;
  slug: string;
  title: string;
  /** The quoted card sentence (resolved on the server by id). */
  sentenceId: string;
  sentence: string;
  /** The resident's words that led the keyword matcher to this card. */
  matchedTerms?: string[];
};

export type CaseTriage = {
  /** "ai" when Claude produced it; "keywords" when AI was unavailable. */
  source: "ai" | "keywords";
  aiStatus:
    | "ok"
    | "unavailable"
    | "refusal"
    | "max_tokens"
    | "invalid"
    | "error"
    | "timeout";
  summary: string | null;
  areas: MapaArea[];
  urgency: Urgency | null;
  /** Crisis signals found by the deterministic filter (forces urgency "high"). */
  crisis?: { categories: string[]; matched: string[] } | null;
  /** Free-text guess, e.g. „powiat nowotarski" — to verify. */
  powiatGuess: string | null;
  suggestedExpertId: string | null;
  similarCaseIds: string[];
  /** Never sent automatically. Drafted only from `cards`. */
  replyDraft: string;
  cards: TriageCard[];
  /** True when this triage wrote the case's areas (so a re-run may replace them). */
  appliedAreas?: boolean;
  createdAt: string;
};

/*
 * The Polish constants below are kept for existing callers. Text that goes to
 * a case author must use the case's language: `replyClosing(locale)`,
 * `residentTeamName(locale)`, `residentStatusLabel(locale, s)` and
 * `residentKindLabel(locale, k)` from `./author-text` (server), or the
 * `cases` messages (`kind.*`, `status.*`) in components.
 */

/** Staff display names in the thread. */
export const TEAM_NAME = "Zespół Hubu ROPS";
/** What residents see instead: they know „ROPS", not the Hub's team name. */
export const RESIDENT_TEAM_NAME = "ROPS Kraków";

/** Closing line of every reply to a resident: the thread stays open. */
export const REPLY_CLOSING =
  "Jeśli masz pytania, odpisz tutaj — odpowiemy w tym wątku.";

/** Resident-facing status words (the enums and staff labels stay as they are). */
export const RESIDENT_STATUS_LABEL: Record<CaseStatus, string> = {
  new: "Przyjęta",
  triaged: "Czytamy",
  in_progress: "Szukamy odpowiedzi",
  answered: "Masz odpowiedź",
  closed: "Zamknięta",
};

/** Resident-facing kind names: a need is a request for help. */
export const RESIDENT_KIND_LABEL: Record<CaseKind, string> = {
  ...CASE_KIND_LABEL,
  need: "Prośba o pomoc",
};
export const SYSTEM_NAME = "Już Działa";
export const AUTHOR_NAME = "Autor sprawy";
