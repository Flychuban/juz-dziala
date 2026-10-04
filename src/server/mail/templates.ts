import "server-only";

import { env } from "~/env";
import type { Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import {
  labelsFor,
  type AuthorRole,
  type CaseKind,
  type ContactPref,
} from "~/lib/domain";
import { residentKindLabel } from "~/server/cases/author-text";

/**
 * Outbound text. Everything sent TO A CASE AUTHOR is written in the case's
 * language (`cases.locale`); staff e-mails are Polish. Strings live in
 * messages/{pl,en}/mail.json.
 */

/** Absolute base URL for links in e-mails and QR codes. */
export function siteUrl(): string {
  const fromEnv = env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** The case page; with the token it is the private link (read and reply). */
export const caseUrl = (code: string, token?: string) =>
  token
    ? `${siteUrl()}/case/${code}?t=${encodeURIComponent(token)}`
    : `${siteUrl()}/case/${code}`;
export const adminCaseUrl = (code: string) =>
  `${siteUrl()}/admin/cases/${code}`;

/**
 * `text` is sent; `logText` is what the delivery log keeps (the private-link
 * token masked — staff screens never show it).
 */
export type Mail = { subject: string; text: string; logText?: string };

const mask = (text: string, token?: string) =>
  token ? text.split(encodeURIComponent(token)).join("•••") : undefined;

function signature(locale: Locale): string {
  const t = translatorFor(locale, "mail");
  const site = labelsFor(locale).site;
  return [t("common.team"), site.hub, site.owner].join("\n");
}

function footer(locale: Locale): string {
  return translatorFor(locale, "mail")("common.autoFooter", {
    site: labelsFor(locale).site.name,
  });
}

/** Receipt to the author right after the case is created (with the private link). */
export function receiptEmail(
  c: { code: string; kind: CaseKind; locale: Locale },
  token?: string,
): Mail {
  const t = translatorFor(c.locale, "mail");
  const text = [
    t("common.greeting"),
    "",
    t("receipt.thanks", { kind: residentKindLabel(c.locale, c.kind) }),
    "",
    t("receipt.code", { code: c.code }),
    "",
    t("receipt.where"),
    caseUrl(c.code, token),
    ...(token ? ["", t("receipt.privateLink")] : []),
    "",
    t("receipt.orCode", { url: `${siteUrl()}/case` }),
    t("receipt.keepCode"),
    "",
    signature(c.locale),
    "",
    footer(c.locale),
  ].join("\n");
  return {
    subject: t("receipt.subject", { code: c.code }),
    text,
    logText: mask(text, token),
  };
}

export function receiptSms(
  c: { code: string; locale: Locale },
  token?: string,
): { text: string; logText?: string } {
  const text = translatorFor(c.locale, "mail")("receipt.sms", {
    site: labelsFor(c.locale).site.name,
    code: c.code,
    url: caseUrl(c.code, token),
  });
  return { text, logText: mask(text, token) };
}

/** Staff inbox e-mail about a new case. No body text — it stays in the panel. Polish. */
export function staffNewCaseEmail(c: {
  code: string;
  kind: CaseKind;
  title: string;
  authorRole: AuthorRole;
  contactPref: ContactPref;
  onBehalf: boolean;
  locale: Locale;
}): Mail {
  const t = translatorFor("pl", "mail");
  const l = labelsFor("pl");
  return {
    subject: t("staffNewCase.subject", {
      site: l.site.name,
      kind: l.caseKind[c.kind],
      code: c.code,
    }),
    text: [
      t("staffNewCase.intro"),
      "",
      t("staffNewCase.kind", { kind: l.caseKind[c.kind] }),
      t("staffNewCase.title", { title: c.title }),
      t("staffNewCase.who", {
        role: l.authorRole[c.authorRole],
        onBehalf: c.onBehalf ? "yes" : "no",
      }),
      t("staffNewCase.contact", { pref: l.contactPref[c.contactPref] }),
      ...(c.locale === "en" ? [t("staffNewCase.english")] : []),
      "",
      t("staffNewCase.open"),
      adminCaseUrl(c.code),
      "",
      t("staffNewCase.ai"),
      "",
      footer("pl"),
    ].join("\n"),
  };
}

/** A staff reply delivered to the author by e-mail, in the case's language. */
export function replyEmail(c: {
  code: string;
  from: string;
  body: string;
  locale: Locale;
}): Mail {
  const t = translatorFor(c.locale, "mail");
  return {
    subject: t("reply.subject", { code: c.code }),
    text: [
      t("common.greeting"),
      "",
      t("reply.intro", { code: c.code, from: c.from }),
      "",
      c.body,
      "",
      t("reply.thread"),
      caseUrl(c.code),
      t("reply.howToReply"),
      "",
      signature(c.locale),
      "",
      footer(c.locale),
    ].join("\n"),
  };
}

export function replySms(c: { code: string; locale: Locale }): string {
  return translatorFor(c.locale, "mail")("reply.sms", {
    site: labelsFor(c.locale).site.name,
    code: c.code,
    url: caseUrl(c.code),
  });
}
