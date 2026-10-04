/** Date, age and plural helpers for case screens. Client-safe. */
import { INTL_LOCALE, TIME_ZONE } from "~/i18n/config";

const formats = (tag: string) => ({
  dateTime: new Intl.DateTimeFormat(tag, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }),
  dateOnly: new Intl.DateTimeFormat(tag, {
    dateStyle: "long",
    timeZone: TIME_ZONE,
  }),
});
const FMT = { pl: formats(INTL_LOCALE.pl), en: formats(INTL_LOCALE.en) };
const fmt = (locale: string) => (locale === "en" ? FMT.en : FMT.pl);

/** „3 paź 2026, 14:05" / "3 Oct 2026, 14:05" (Europe/Warsaw). Polish by default. */
export const fmtDateTime = (d: Date | string, locale = "pl") =>
  fmt(locale).dateTime.format(new Date(d));
/** „3 października 2026" / "3 October 2026". Polish by default. */
export const fmtDate = (d: Date | string, locale = "pl") =>
  fmt(locale).dateOnly.format(new Date(d));

/** 1 sprawa · 2 sprawy · 5 spraw · 12 spraw · 22 sprawy */
export function plural(
  n: number,
  [one, few, many]: [string, string, string],
): string {
  if (n === 1) return one;
  const d = n % 10;
  const dd = n % 100;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

export function ageLabel(d: Date | string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(d).getTime()) / 60000));
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const days = Math.floor(h / 24);
  return `${days} ${plural(days, ["dzień", "dni", "dni"])} temu`;
}

/** Hours since a date — for „czeka ponad 48 h" markers. */
export const hoursSince = (d: Date | string, now = Date.now()) =>
  (now - new Date(d).getTime()) / 3_600_000;

/** Tolerant client-side code check: „jd 7k3q x9mp" → „JD-7K3Q-X9MP". */
export function looseCaseCode(s: string): string | null {
  const raw = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.length === 10 && raw.startsWith("JD") ? raw.slice(2) : raw;
  if (body.length !== 8) return null;
  return `JD-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Any next-intl translator scoped to `cases.modules` (client or server). */
type ModulesT = ((key: never) => string) & { has: (key: never) => boolean };

/**
 * A plan detail's value in the reader's language: an answer code (`option`,
 * e.g. "ops", "50-200") is named from `cases.modules.plan.option.*`; free
 * text and unknown codes keep the stored value.
 */
export function planDetailValue(
  t: ModulesT,
  d: { key: string; value: string; option?: string },
): string {
  if (!d.option) return d.value;
  const path = `plan.option.${d.key}.${d.option}` as never;
  return t.has(path) ? t(path) : d.value;
}
