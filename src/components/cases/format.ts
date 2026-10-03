/** Polish date, age and plural helpers for case screens. Client-safe. */
const TZ = "Europe/Warsaw";

const dateTime = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TZ,
});
const dateOnly = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: TZ,
});

export const fmtDateTime = (d: Date | string) => dateTime.format(new Date(d));
export const fmtDate = (d: Date | string) => dateOnly.format(new Date(d));

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
