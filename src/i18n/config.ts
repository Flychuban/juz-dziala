/**
 * Language settings — client-safe (no server imports).
 * Polish is always the default; English is an explicit choice kept in a cookie,
 * so URLs never change and a Polish juror with an English browser still sees Polish.
 */
export const LOCALES = ["pl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_COOKIE = "jd_lang";
export const TIME_ZONE = "Europe/Warsaw";

/** BCP 47 tags for Intl, speech and <html lang>. */
export const INTL_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };

export function isLocale(v: unknown): v is Locale {
  return v === "pl" || v === "en";
}

/** Reads the locale from a raw Cookie header (route handlers, tRPC context). */
export function localeFromCookieHeader(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const m = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(header);
  const v = m?.[1];
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
