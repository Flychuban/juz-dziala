/**
 * Translators for the pure Middleman / „Dla gminy" logic (plan template,
 * profile rule). The same messages the screens use (messages/{pl,en}/adapt.json
 * and municipality.json), without a request: these modules are unit-tested.
 */
import { createTranslator } from "next-intl";

import { TIME_ZONE, type Locale } from "~/i18n/config";
import { MESSAGES } from "~/i18n/messages";

export function adaptT(locale: Locale) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "adapt",
    timeZone: TIME_ZONE,
  });
}

export function municipalityT(locale: Locale) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "municipality",
    timeZone: TIME_ZONE,
  });
}

export type AdaptT = ReturnType<typeof adaptT>;
export type MunicipalityT = ReturnType<typeof municipalityT>;
