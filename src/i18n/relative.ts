/**
 * „przed chwilą" / „5 min temu" / „2 dni temu" in the current language.
 * Pass a translator for the `common.time` namespace:
 *   const tt = useTranslations("common.time"); relativeAge(date, tt)
 */
type TimeT = (key: "justNow" | "minutesAgo" | "hoursAgo" | "daysAgo", values?: { n: number }) => string;

export function relativeAge(d: Date | string, t: TimeT, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(d).getTime()) / 60000));
  if (min < 1) return t("justNow");
  if (min < 60) return t("minutesAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("hoursAgo", { n: h });
  return t("daysAgo", { n: Math.floor(h / 24) });
}
