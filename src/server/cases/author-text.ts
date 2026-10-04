import "server-only";

import { isLocale, type Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import {
  CASE_KINDS,
  CASE_STATUSES,
  type CaseKind,
  type CaseStatus,
} from "~/lib/domain";

/**
 * Text the Sprawa engine writes FOR the case author, in the case's language
 * (`cases.locale`). Staff-side text stays Polish. The Polish values are the
 * same as the old constants in `./types` (REPLY_CLOSING, RESIDENT_TEAM_NAME).
 *
 *   replyClosing(c.locale)      // closing line of a staff reply
 *   residentTeamName(c.locale)  // „ROPS Kraków"
 */
export function caseLocale(v: unknown): Locale {
  return isLocale(v) ? v : "pl";
}

/** First system message in a new case's thread. */
export function receivedText(locale: Locale): string {
  return translatorFor(locale, "cases")("author.received");
}

/** Closing line of every reply to a resident: the thread stays open. */
export function replyClosing(locale: Locale): string {
  return translatorFor(locale, "cases")("author.replyClosing");
}

/** How residents know the team (signature, sender name). */
export function residentTeamName(locale: Locale): string {
  return translatorFor(locale, "cases")("author.teamName");
}

/** Resident-facing status word („Masz odpowiedź" / "You have a reply"). */
export function residentStatusLabel(locale: Locale, status: string): string {
  const t = translatorFor(locale, "cases");
  return isStatus(status) ? t(`status.${status}`) : status;
}

/** Resident-facing kind („Prośba o pomoc" / "Request for help"). */
export function residentKindLabel(locale: Locale, kind: string): string {
  const t = translatorFor(locale, "cases");
  return isKind(kind) ? t(`kind.${kind}`) : kind;
}

const isStatus = (s: string): s is CaseStatus =>
  (CASE_STATUSES as readonly string[]).includes(s);
const isKind = (s: string): s is CaseKind =>
  (CASE_KINDS as readonly string[]).includes(s);
