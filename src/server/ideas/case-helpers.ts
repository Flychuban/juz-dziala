import "server-only";

import type { Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { createCase, type CreateCaseInput } from "~/server/cases";
import { isKnownGmina } from "./data";
import { contactProblemKey } from "./schema";

/** A contact or gmina problem of a resident form, in the visitor's language, or null. */
export async function contactOrGminaProblem(
  locale: Locale,
  input: { contactPref: "email" | "sms" | "phone" | "none"; contact?: string; gminaTeryt?: string },
): Promise<string | null> {
  const t = translatorFor(locale, "ideas");
  const k = contactProblemKey(input.contactPref, input.contact);
  if (k) return t(`people.contactError.${k}`);
  if (!(await isKnownGmina(input.gminaTeryt))) return t("people.gminaFromList");
  return null;
}

/** Opens a case in the author's language (replies and mail reach them in it). */
export async function createCaseInLocale(input: CreateCaseInput, locale: Locale) {
  return createCase({ ...input, locale });
}
