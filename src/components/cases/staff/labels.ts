/**
 * Small helpers shared by the staff case screens. Every word lives in
 * messages/{pl,en}/admin.json; this file only formats and links.
 */
import { INTL_LOCALE, isLocale, TIME_ZONE } from "~/i18n/config";
import {
  CASE_KINDS,
  CASE_STATUSES,
  MAPA_AREAS,
  type CaseKind,
  type CaseStatus,
  type MapaArea,
} from "~/lib/domain";

export const caseHref = (basePath: "/admin/cases" | "/expert", code: string) =>
  basePath === "/expert" ? `/expert?code=${code}` : `/admin/cases/${code}`;

const intl = (locale: string) => INTL_LOCALE[isLocale(locale) ? locale : "pl"];

/** „3 paź 2026, 14:05" / "3 Oct 2026, 14:05" (Europe/Warsaw). */
export function fmtDateTime(d: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(intl(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(d));
}

/** Hours since a date — for „czeka ponad 48 h" markers. */
export const hoursSince = (d: Date | string, now = Date.now()) =>
  (now - new Date(d).getTime()) / 3_600_000;

/** Open statuses: the ones a „waiting over 48 h" marker applies to. */
export const isOpenStatus = (s: string) =>
  s === "new" || s === "triaged" || s === "in_progress";

const pick = <T extends string>(
  v: string | null | undefined,
  all: readonly T[],
) => (v && (all as readonly string[]).includes(v) ? (v as T) : undefined);

/**
 * The inbox filters kept in the URL → the `admin.inbox.list` input. Shared by
 * the list (client) and the pages that prefetch it (server), so both ask for
 * exactly the same query.
 */
export function inboxInput(get: (key: string) => string | null | undefined) {
  const q = get("q")?.trim();
  return {
    status: pick<CaseStatus>(get("status"), CASE_STATUSES),
    kind: pick<CaseKind>(get("kind"), CASE_KINDS),
    area: pick<MapaArea>(get("area"), MAPA_AREAS),
    q: q?.length ? q : undefined,
    waiting: get("waiting") === "1" || undefined,
  };
}
