import "server-only";

import { ideasFanout } from "~/server/ideas/fanout";

import { eq } from "drizzle-orm";

import { env } from "~/env";
import { CASE_KIND_LABEL, CASE_STATUS_LABEL } from "~/lib/domain";
import {
  takeDelivery,
  type DeliveryOutcome,
} from "~/server/cases/delivery-intent";
import { insertMessage } from "~/server/cases/messages";
import { SYSTEM_NAME, TEAM_NAME } from "~/server/cases/types";
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
 * The loop the jury tests:
 *   new case     → ROPS bell (badge, tab title, desktop notification), e-mail
 *                  to ROPS_INBOX_EMAIL, receipt to the author by their channel;
 *   staff reply  → the author's thread, plus e-mail / simulated SMS / callback
 *                  note when the staff member ticks „Wyślij też…";
 *   author reply → bell for ROPS and the assigned expert.
 */
type CaseRow = typeof cases.$inferSelect;
type NotificationRow = typeof notifications.$inferInsert;

const excerpt = (s: string, n = 140) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

const expertHref = (code: string) => `/expert?code=${code}`;
const adminHref = (code: string) => `/admin/cases/${code}`;
const authorHref = (code: string) => `/case/${code}`;

async function loadCase(caseId: string): Promise<CaseRow | null> {
  const [c] = await db.select().from(cases).where(eq(cases.id, caseId));
  return c ?? null;
}

function expertOf(c: CaseRow): string | null {
  return c.assigneeId && c.assigneeId !== "rops" ? c.assigneeId : null;
}

/** The author's channel. Sample cases never send anything. */
async function deliverToAuthor(
  c: CaseRow,
  msg: {
    email: { subject: string; text: string };
    sms: string;
    callback: string;
  },
): Promise<DeliveryOutcome> {
  if (c.isSample) return { channel: c.contactPref, status: "skipped" };
  const contact = c.contactEnc ? decrypt(c.contactEnc) : null;
  switch (c.contactPref) {
    case "email": {
      if (!contact)
        return { channel: "email", status: "failed", error: "Brak adresu." };
      const r = await sendMail({ to: contact, ...msg.email, caseId: c.id });
      return { channel: "email", ...r };
    }
    case "sms": {
      if (!contact)
        return { channel: "sms", status: "failed", error: "Brak numeru." };
      const r = await simulateSms({ to: contact, text: msg.sms, caseId: c.id });
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
  await db.insert(notifications).values([
    {
      recipient: "rops",
      caseId: c.id,
      kind: "case.created",
      title: `Nowa sprawa: ${CASE_KIND_LABEL[c.kind]}`,
      body: c.title,
      href: adminHref(c.code),
    },
    {
      recipient: `case:${c.id}`,
      caseId: c.id,
      kind: "case.created",
      title: "Sprawa przyjęta",
      body: "Odpowiemy zwykle w ciągu 2 dni roboczych.",
      href: authorHref(c.code),
    },
  ]);
  if (env.ROPS_INBOX_EMAIL && !c.isSample) {
    await sendMail({
      to: env.ROPS_INBOX_EMAIL,
      ...staffNewCaseEmail(c),
      caseId: c.id,
    });
  }
  await deliverToAuthor(c, {
    email: receiptEmail(c),
    sms: receiptSms(c),
    callback: `Autor prosi o kontakt telefoniczny (${c.contactMasked ?? "numer w danych kontaktowych"}). Zadzwoń, aby potwierdzić przyjęcie sprawy.`,
  });
}

async function onCaseTriaged(caseId: string) {
  const c = await loadCase(caseId);
  if (!c) return;
  const expert = expertOf(c);
  const rows: NotificationRow[] = [
    {
      recipient: `case:${c.id}`,
      caseId: c.id,
      kind: "case.triaged",
      title: "Sprawa wstępnie oceniona",
      body: "Zespół Hubu zajmie się nią wkrótce.",
      href: authorHref(c.code),
    },
  ];
  if (expert) {
    rows.push({
      recipient: `expert:${expert}`,
      caseId: c.id,
      kind: "case.triaged",
      title: `Wstępna ocena gotowa: ${c.code}`,
      body: c.title,
      href: expertHref(c.code),
    });
  }
  await db.insert(notifications).values(rows);
}

async function onCaseAssigned(caseId: string, assigneeId: string) {
  const c = await loadCase(caseId);
  if (!c || assigneeId === "rops") return;
  await db.insert(notifications).values({
    recipient: `expert:${assigneeId}`,
    caseId: c.id,
    kind: "case.assigned",
    title: `Przydzielono Ci sprawę: ${CASE_KIND_LABEL[c.kind]}`,
    body: c.title,
    href: expertHref(c.code),
  });
}

async function onCaseStatus(caseId: string, status: string) {
  const c = await loadCase(caseId);
  if (!c) return;
  const label =
    status in CASE_STATUS_LABEL
      ? CASE_STATUS_LABEL[status as keyof typeof CASE_STATUS_LABEL]
      : status;
  await db.insert(notifications).values({
    recipient: `case:${c.id}`,
    caseId: c.id,
    kind: "case.status",
    title: `Status sprawy: ${label}`,
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
  const expert = expertOf(c);

  if (m.authorKind === "author") {
    const rows: NotificationRow[] = [
      {
        recipient: "rops",
        caseId: c.id,
        kind: "message.author",
        title: `Nowa wiadomość od autora: ${c.code}`,
        body: excerpt(m.body),
        href: adminHref(c.code),
      },
    ];
    if (expert) {
      rows.push({
        recipient: `expert:${expert}`,
        caseId: c.id,
        kind: "message.author",
        title: `Nowa wiadomość od autora: ${c.code}`,
        body: excerpt(m.body),
        href: expertHref(c.code),
      });
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
      await db.insert(notifications).values({
        recipient: to,
        caseId: c.id,
        kind: "message.note",
        title: `Notatka wewnętrzna: ${c.code}`,
        body: excerpt(m.body),
        href: to === "rops" ? adminHref(c.code) : expertHref(c.code),
      });
    }
    return;
  }

  const from = m.authorName ?? TEAM_NAME;
  const rows: NotificationRow[] = [
    {
      recipient: `case:${c.id}`,
      caseId: c.id,
      kind: "message.staff",
      title: `Nowa odpowiedź od: ${from}`,
      href: authorHref(c.code),
    },
  ];
  if (m.authorKind === "expert") {
    rows.push({
      recipient: "rops",
      caseId: c.id,
      kind: "message.staff",
      title: `Ekspert odpowiedział: ${c.code}`,
      body: excerpt(m.body),
      href: adminHref(c.code),
    });
  }
  await db.insert(notifications).values(rows);

  if (intent) {
    const when = m.createdAt.toLocaleString("pl-PL", {
      timeZone: "Europe/Warsaw",
    });
    intent.outcome = await deliverToAuthor(c, {
      email: replyEmail({ code: c.code, from, body: m.body }),
      sms: replySms(c),
      callback: `Autor wybrał kontakt telefoniczny (${c.contactMasked ?? "numer w danych kontaktowych"}). Zadzwoń i przekaż odpowiedź z ${when}.`,
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
    case "innovation.published":
    case "idea.similarFound":
      // Subscribers by topic ("calls", "area:<MapaArea>") and the idea's author.
      return ideasFanout(ev);
    default: {
      const unreachable: never = ev;
      return unreachable;
    }
  }
}
