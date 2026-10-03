/** Shapes stored in jsonb by the Sprawa engine. Client-safe. */
import type { MapaArea, Urgency } from "~/lib/domain";

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
  createdAt: string;
};

/** Staff display names in the thread. */
export const TEAM_NAME = "Zespół Hubu ROPS";
export const SYSTEM_NAME = "Już Działa";
export const AUTHOR_NAME = "Autor sprawy";
