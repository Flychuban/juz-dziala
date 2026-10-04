import "server-only";

import { eq } from "drizzle-orm";

import type { Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { createCase, type CreateCaseInput } from "~/server/cases";
import { db } from "~/server/db";
import { cases } from "~/server/db/schema";
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

/**
 * Opens a case in the author's language. `locale` goes to `createCase` (the
 * case engine reads it once its input accepts it — until then zod drops the
 * key) and is also written right after, so replies and mail reach the author
 * in the language they used either way.
 */
export async function createCaseInLocale(input: CreateCaseInput, locale: Locale) {
  // TODO(locale): once createCase's input has `locale`, pass `{ ...input, locale }` directly and drop the update below.
  const withLocale: CreateCaseInput & { locale: Locale } = { ...input, locale };
  const created = await createCase(withLocale);
  if (locale !== "pl") await db.update(cases).set({ locale }).where(eq(cases.id, created.id));
  return created;
}
