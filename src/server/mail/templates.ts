import "server-only";

import { env } from "~/env";
import { RESIDENT_KIND_LABEL, RESIDENT_TEAM_NAME } from "~/server/cases/types";
import {
  AUTHOR_ROLE_LABEL,
  CASE_KIND_LABEL,
  CONTACT_PREF_LABEL,
  SITE,
  type AuthorRole,
  type CaseKind,
  type ContactPref,
} from "~/lib/domain";

/** Absolute base URL for links in e-mails and QR codes. */
export function siteUrl(): string {
  const fromEnv = env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const caseUrl = (code: string) => `${siteUrl()}/case/${code}`;
export const adminCaseUrl = (code: string) =>
  `${siteUrl()}/admin/cases/${code}`;

/** Residents know „ROPS", not the Hub's team name. */
const SIGNATURE = `${RESIDENT_TEAM_NAME}
${SITE.hub}
${SITE.owner}`;

const AUTO_FOOTER = `—
Ta wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.
Odpowiedz w wątku sprawy na stronie ${SITE.name}.`;

type Mail = { subject: string; text: string };

/** Receipt to the author right after the case is created. */
export function receiptEmail(c: { code: string; kind: CaseKind }): Mail {
  return {
    subject: `Przyjęliśmy Twoją sprawę ${c.code}`,
    text: `Dzień dobry,

dziękujemy. Twoja sprawa („${RESIDENT_KIND_LABEL[c.kind]}”) została przyjęta.

Kod sprawy: ${c.code}

Odpowiemy zwykle w ciągu 2 dni roboczych. Odpowiedź zobaczysz tutaj:
${caseUrl(c.code)}

Możesz też wejść na ${siteUrl()}/case i wpisać kod sprawy.
Zachowaj ten kod — dzięki niemu sprawdzisz odpowiedź.

${SIGNATURE}

${AUTO_FOOTER}`,
  };
}

export function receiptSms(c: { code: string }): string {
  return `${SITE.name}: przyjęliśmy Twoją sprawę. Kod: ${c.code}. Odpowiedź sprawdzisz na ${caseUrl(c.code)}`;
}

/** Staff inbox e-mail about a new case. No body text — it stays in the panel. */
export function staffNewCaseEmail(c: {
  code: string;
  kind: CaseKind;
  title: string;
  authorRole: AuthorRole;
  contactPref: ContactPref;
  onBehalf: boolean;
}): Mail {
  return {
    subject: `[${SITE.name}] Nowa sprawa: ${CASE_KIND_LABEL[c.kind]} — ${c.code}`,
    text: `Nowa sprawa w skrzynce Hubu.

Rodzaj: ${CASE_KIND_LABEL[c.kind]}
Tytuł: ${c.title}
Kto zgłasza: ${AUTHOR_ROLE_LABEL[c.authorRole]}${c.onBehalf ? " (w imieniu innej osoby)" : ""}
Preferowany kontakt: ${CONTACT_PREF_LABEL[c.contactPref]}

Otwórz sprawę w panelu:
${adminCaseUrl(c.code)}

Wstępna ocena AI pojawi się w panelu w ciągu kilkudziesięciu sekund (jeśli AI jest dostępne).

${AUTO_FOOTER}`,
  };
}

/** A staff reply delivered to the author by e-mail. */
export function replyEmail(c: {
  code: string;
  from: string;
  body: string;
}): Mail {
  return {
    subject: `Odpowiedź w Twojej sprawie ${c.code}`,
    text: `Dzień dobry,

w Twojej sprawie ${c.code} jest nowa odpowiedź od: ${c.from}.

${c.body}

Cały wątek i możliwość odpowiedzi:
${caseUrl(c.code)}

${SIGNATURE}

${AUTO_FOOTER}`,
  };
}

export function replySms(c: { code: string }): string {
  return `${SITE.name}: nowa odpowiedź w sprawie ${c.code}. Sprawdź: ${caseUrl(c.code)}`;
}
