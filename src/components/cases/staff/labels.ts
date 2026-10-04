/**
 * Small helpers shared by the staff case screens. Every word lives in
 * messages/{pl,en}/admin.json; this file only formats and links.
 */
import { INTL_LOCALE, isLocale, TIME_ZONE } from "~/i18n/config";

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
