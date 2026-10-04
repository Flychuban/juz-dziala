import "server-only";

import { ideasFanout } from "~/server/ideas/fanout";
import {
  notifyCallSubscribers,
  notifyInnovationSubscribers,
} from "~/server/subscriptions/fanout";

import { eq } from "drizzle-orm";

import { env } from "~/env";
import { translatorFor } from "~/i18n/server";
import { labelsFor } from "~/lib/domain";
import {
  caseLocale,
  residentStatusLabel,
  residentTeamName,
} from "~/server/cases/author-text";
import {
  takeDelivery,
  takeReceiptToken,
  type DeliveryOutcome,
} from "~/server/cases/delivery-intent";
import { insertMessage } from "~/server/cases/messages";
import { SYSTEM_NAME } from "~/server/cases/types";
import { db } from "~/server/db";
import { cases, messages, notifications } from "~/server/db/schema";
import { decrypt } from "~/server/lib/crypto";
import { recordCallbackTask, sendMail, simulateSms } from "~/server/mail/send";
import {
  receiptEmail,
  receiptSms,
  replyEmail,
  replySms,
  staffNewCaseEmail,
} from "~/server/mail/templates";
import type { NotifyEvent } from "./notify";

/**
 * Fan-out of domain events to in-app notifications and deliveries.
 *
 * Recipients: "rops" (the Hub team), "expert:<personId>" (an assigned
 * expert) and "case:<caseId>" (the author, shown on /case/<code>).
 *
 * Languages: staff notifications are written in Polish (title/body) with an
 * English copy in `en` (the bell shows it to staff using the site in
 * English); everything for the author uses the case's language.
 *
 * The loop the jury tests:
 *   new case     → ROPS bell (badge, tab title, desktop notification), e-mail
 *                  to ROPS_INBOX_EMAIL, receipt to the author by their channel;
 *   staff reply  → the author's thread, plus e-mail / simulated SMS / callback
 *                  note when the staff member ticks „Wyślij też…";
 *   author reply → bell for ROPS and the assigned expert.
 */
type CaseRow = typeof cases.$inferSelect;
type NotificationRow = typeof notifications.$inferInsert;
type StaffKey =
  | "newCase"
  | "triaged"
  | "assigned"
  | "authorMessage"
  | "note"
  | "expertReplied";

const excerpt = (s: string, n = 140) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

const expertHref = (code: string) => `/expert?code=${code}`;
const adminHref = (code: string) => `/admin/cases/${code}`;
const authorHref = (code: string) => `/case/${code}`;

/**
 * A staff notification: Polish title, English title in `en`. The body is the
 * case's own text (title, excerpt — later the triage summary), the same in
 * both languages, so `en` carries no body and the bell falls back to `body`.
 */
function staffNote(
  row: Omit<NotificationRow, "title" | "en">,
  key: StaffKey,
  c: CaseRow,
): NotificationRow {
  const title = (locale: "pl" | "en") =>
    translatorFor(locale, "mail")(`notifications.staff.${key}`, {
      code: c.code,
      kind: labelsFor(locale).caseKind[c.kind],
    });
  return { ...row, title: title("pl"), en: { title: title("en") } };
}

async function loadCase(caseId: string): Promise<CaseRow | null> {
  const [c] = await db.select().from(cases).where(eq(cases.id, caseId));
  return c ?? null;
}

function expertOf(c: CaseRow): string | null {
  return c.assigneeId && c.assigneeId !== "rops" ? c.assigneeId : null;
}

/** Staff-facing callback note (Polish), saying when the author reads English. */
function callbackNote(
  c: CaseRow,
  key: "receipt" | "reply",
  when?: string,
): string {
  const t = translatorFor("pl", "mail");
  const note = t(`callback.${key}`, {
    contact: c.contactMasked ?? t("callback.noContact"),
    when: when ?? "",
  });
  return caseLocale(c.locale) === "en"
    ? `${note} ${t("callback.english")}`
    : note;
}

/** The author's channel. Sample cases never send anything. */
async function deliverToAuthor(
  c: CaseRow,
  msg: {
    email: { subject: string; text: string; logText?: string };
    sms: { text: string; logText?: string };
    callback: string;
  },
): Promise<DeliveryOutcome> {
  if (c.isSample) return { channel: c.contactPref, status: "skipped" };
  const contact = c.contactEnc ? decrypt(c.contactEnc) : null;
  const t = translatorFor("pl", "mail");
  switch (c.contactPref) {
    case "email": {
      if (!contact)
        return {
          channel: "email",
          status: "failed",
          error: t("delivery.noAddress"),
        };
      const r = await sendMail({ to: contact, ...msg.email, caseId: c.id });
      return { channel: "email", ...r };
    }
    case "sms": {
      if (!contact)
        return {
          channel: "sms",
          status: "failed",
          error: t("delivery.noNumber"),
        };
      const r = await simulateSms({ to: contact, ...msg.sms, caseId: c.id });
      return { channel: "sms", ...r };
    }
    case "phone": {
      await insertMessage({
        caseId: c.id,
        authorKind: "system",
        authorName: SYSTEM_NAME,
        body: msg.callback,
        visibleToAuthor: false,
      });
      const r = await recordCallbackTask({
        to: contact ?? "",
        text: msg.callback,
        caseId: c.id,
      });
      return { channel: "phone", ...r };
    }
    case "none":
      return { channel: "none", status: "none" };
  }
}

async function onCaseCreated(caseId: string) {
  const c = await loadCase(caseId);
  if (!c) return;
  const locale = caseLocale(c.locale);
  const ta = translatorFor(locale, "mail");
  // Lent by createCase for this call only; the receipt carries the private link.
  const token = takeReceiptToken(c.id);
  await db.insert(notifications).values([
    staffNote(
      {
        recipient: "rops",
        caseId: c.id,
        kind: "case.created",
        body: c.title,
        href: adminHref(c.code),
      },
      "newCase",
      c,
    ),
    {
      recipient: `case:${c.id}`,
      caseId: c.id,
      kind: "case.created",
      title: ta("notifications.author.receivedTitle"),
      body: ta("notifications.author.receivedBody"),
      href: authorHref(c.code),
    },
  ]);
  if (env.ROPS_INBOX_EMAIL && !c.isSample) {
    await sendMail({
      to: env.ROPS_INBOX_EMAIL,
      ...staffNewCaseEmail({ ...c, locale }),
      caseId: c.id,
    });
  }
  await deliverToAuthor(c, {
    email: receiptEmail({ ...c, locale }, token),
    sms: receiptSms({ ...c, locale }, token),
    callback: callbackNote(c, "receipt"),
  });
}

async function onCaseTriaged(caseId: string) {
  const c = await loadCase(caseId);
  if (!c) return;
  const ta = translatorFor(caseLocale(c.locale), "mail");
  const expert = expertOf(c);
  const rows: NotificationRow[] = [
    {
      recipient: `case:${c.id}`,
      caseId: c.id,
      kind: "case.triaged",
      title: ta("notifications.author.triagedTitle"),
      body: ta("notifications.author.triagedBody"),
      href: authorHref(c.code),
    },
  ];
  if (expert) {
    rows.push(
      staffNote(
        {
          recipient: `expert:${expert}`,
          caseId: c.id,
          kind: "case.triaged",
          body: c.title,
          href: expertHref(c.code),
        },
        "triaged",
        c,
      ),
    );
  }
  await db.insert(notifications).values(rows);
}

async function onCaseAssigned(caseId: string, assigneeId: string) {
  const c = await loadCase(caseId);
  if (!c || assigneeId === "rops") return;
  await db.insert(notifications).values(
    staffNote(
      {
        recipient: `expert:${assigneeId}`,
        caseId: c.id,
        kind: "case.assigned",
        body: c.title,
        href: expertHref(c.code),
      },
      "assigned",
      c,
    ),
  );
}

async function onCaseStatus(caseId: string, status: string) {
  const c = await loadCase(caseId);
  if (!c) return;
  const locale = caseLocale(c.locale);
  await db.insert(notifications).values({
    recipient: `case:${c.id}`,
    caseId: c.id,
    kind: "case.status",
    title: translatorFor(locale, "mail")("notifications.author.status", {
      status: residentStatusLabel(locale, status),
    }),
    href: authorHref(c.code),
  });
}

async function onMessageCreated(caseId: string, messageId: string) {
  const intent = takeDelivery(messageId);
  const c = await loadCase(caseId);
  const [m] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));
  if (!c || !m) return;
  const locale = caseLocale(c.locale);
  const expert = expertOf(c);

  if (m.authorKind === "author") {
    const rows: NotificationRow[] = [
      staffNote(
        {
          recipient: "rops",
          caseId: c.id,
          kind: "message.author",
          body: excerpt(m.body),
          href: adminHref(c.code),
        },
        "authorMessage",
        c,
      ),
    ];
    if (expert) {
      rows.push(
        staffNote(
          {
            recipient: `expert:${expert}`,
            caseId: c.id,
            kind: "message.author",
            body: excerpt(m.body),
            href: expertHref(c.code),
          },
          "authorMessage",
          c,
        ),
      );
    }
    await db.insert(notifications).values(rows);
    return;
  }

  if (m.authorKind !== "rops" && m.authorKind !== "expert") return;

  if (!m.visibleToAuthor) {
    // An internal note tells the other side of the staff team.
    const to =
      m.authorKind === "expert" ? "rops" : expert ? `expert:${expert}` : null;
    if (to) {
      await db.insert(notifications).values(
        staffNote(
          {
            recipient: to,
            caseId: c.id,
            kind: "message.note",
            body: excerpt(m.body),
            href: to === "rops" ? adminHref(c.code) : expertHref(c.code),
          },
          "note",
          c,
        ),
      );
    }
    return;
  }

  // The resident sees „ROPS Kraków" for the team, an expert by name.
  const from =
    m.authorKind === "expert" && m.authorName
      ? m.authorName
      : residentTeamName(locale);
  const rows: NotificationRow[] = [
    {
      recipient: `case:${c.id}`,
      caseId: c.id,
      kind: "message.staff",
      title: translatorFor(locale, "mail")("notifications.author.newReply", {
        from,
      }),
      href: authorHref(c.code),
    },
  ];
  if (m.authorKind === "expert") {
    rows.push(
      staffNote(
        {
          recipient: "rops",
          caseId: c.id,
          kind: "message.staff",
          body: excerpt(m.body),
          href: adminHref(c.code),
        },
        "expertReplied",
        c,
      ),
    );
  }
  await db.insert(notifications).values(rows);

  if (intent) {
    intent.outcome = await deliverToAuthor(c, {
      email: replyEmail({ code: c.code, from, body: m.body, locale }),
      sms: { text: replySms({ code: c.code, locale }) },
      callback: callbackNote(
        c,
        "reply",
        m.createdAt.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }),
      ),
    });
  }
}

export async function fanout(ev: NotifyEvent): Promise<void> {
  switch (ev.type) {
    case "case.created":
      return onCaseCreated(ev.caseId);
    case "case.triaged":
      return onCaseTriaged(ev.caseId);
    case "case.assigned":
      return onCaseAssigned(ev.caseId, ev.assigneeId);
    case "case.status":
      return onCaseStatus(ev.caseId, ev.status);
    case "message.created":
      return onMessageCreated(ev.caseId, ev.messageId);
    case "call.published":
    case "call.changed":
      // Subscribers of "calls" (delivery report shown in /admin/calls).
      await notifyCallSubscribers(ev.callId, ev.type);
      return;
    case "innovation.published":
      // Subscribers of "area:<MapaArea>".
      await notifyInnovationSubscribers(ev.innovationId);
      return;
    case "idea.similarFound":
      // The idea's author gets a note on their case page.
      return ideasFanout(ev);
    default: {
      const unreachable: never = ev;
      return unreachable;
    }
  }
}
