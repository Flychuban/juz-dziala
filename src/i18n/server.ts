import { createTranslator } from "next-intl";
import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, TIME_ZONE, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";

/** The visitor's language (cookie jd_lang), Polish by default. */
export async function getServerLocale(): Promise<Locale> {
  try {
    const v = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE; // outside a request (seed, scripts)
  }
}

/**
 * Translator for code that runs outside React (mail, notifications, tRPC errors,
 * route handlers). Usage: `const t = translatorFor(locale, "mail"); t("receipt.subject")`.
 */
export function translatorFor<N extends keyof Messages>(locale: Locale, namespace: N) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace,
    timeZone: TIME_ZONE,
  });
}
