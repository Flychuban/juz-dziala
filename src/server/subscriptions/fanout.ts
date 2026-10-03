import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { env } from "~/env";
import { CALL_STATUS_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";
import { db } from "~/server/db";
import {
  calls,
  deliveries,
  innovations,
  subscriptions,
} from "~/server/db/schema";
import { maskContact } from "~/server/domain/case-code";
import { decrypt } from "~/server/lib/crypto";
import { sendMail } from "~/server/mail/send";

/*
 * Notices to people who subscribed to „nabory" or to a Mapa area
 * (jd_subscription, topic "calls" or "area:<MapaArea>"). E-mail goes out
 * through sendMail (real when a transport is configured, otherwise a
 * "skipped" row); SMS is simulated. Every attempt leaves a jd_delivery row
 * carrying the notice's subject, so the editor can show who was notified.
 */

export type SubscriberDelivery = {
  channel: "email" | "sms";
  toMasked: string;
  status: "sent" | "simulated" | "failed" | "skipped";
  error?: string | null;
};

export type FanoutResult = {
  subject: string;
  subscribers: number;
  deliveries: SubscriberDelivery[];
};

const SIGNATURE =
  "Otrzymujesz tę wiadomość, bo zapisałaś/eś się na powiadomienia w serwisie Już Działa (Małopolski Hub Innowacji Społecznych, ROPS w Krakowie).";

/**
 * Sends one notice to every active subscriber of any of `topic`. A contact
 * subscribed to several matching topics gets the notice once.
 */
export async function deliverToSubscribers(opts: {
  topic: string | string[];
  subject: string;
  text: string;
}): Promise<FanoutResult> {
  const topics = [
    ...new Set(Array.isArray(opts.topic) ? opts.topic : [opts.topic]),
  ];
  if (topics.length === 0)
    return { subject: opts.subject, subscribers: 0, deliveries: [] };
  const subs = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.active, true), inArray(subscriptions.topic, topics)),
    );

  const seen = new Set<string>();
  const out: SubscriberDelivery[] = [];
  const body = `${opts.text.trim()}\n\n—\n${SIGNATURE}`;
  for (const s of subs) {
    const contact = decrypt(s.contactEnc);
    const key = `${s.channel}:${contact ?? s.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!contact) {
      await db.insert(deliveries).values({
        channel: s.channel,
        toMasked: s.contactMasked,
        subject: opts.subject,
        body,
        status: "failed",
        error: "Nie udało się odczytać kontaktu.",
      });
      out.push({
        channel: s.channel,
        toMasked: s.contactMasked,
        status: "failed",
        error: "Nie udało się odczytać kontaktu.",
      });
      continue;
    }
    if (s.channel === "email") {
      const r = await sendMail({
        to: contact,
        subject: opts.subject,
        text: body,
      });
      out.push({
        channel: "email",
        toMasked: maskContact(contact),
        status: r.status,
        error: r.error ?? null,
      });
    } else {
      // SMS is simulated in the prototype; the row keeps the subject so the notice can be traced.
      await db.insert(deliveries).values({
        channel: "sms",
        toMasked: maskContact(contact),
        subject: opts.subject,
        body: `${opts.subject}. ${opts.text.split("\n")[0] ?? ""}`.slice(
          0,
          300,
        ),
        status: "simulated",
      });
      out.push({
        channel: "sms",
        toMasked: maskContact(contact),
        status: "simulated",
      });
    }
  }
  return { subject: opts.subject, subscribers: seen.size, deliveries: out };
}

const siteUrl = () => env.NEXT_PUBLIC_SITE_URL ?? "";
const DATE = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});
const PLN = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const date = (d: string | null) =>
  d ? DATE.format(new Date(`${d}T12:00:00Z`)) : "[DO UZUPEŁNIENIA]";

/** The subject line of a call notice (also used to find its deliveries). */
export function callNoticeSubject(
  name: string,
  kind: "call.published" | "call.changed",
) {
  const short = name.length > 90 ? `${name.slice(0, 89).trimEnd()}…` : name;
  return kind === "call.published"
    ? `Nowy nabór: ${short}`
    : `Zmiana w naborze: ${short}`;
}

/** „call.published" / „call.changed" → subscribers of "calls" and of the call's areas. */
export async function notifyCallSubscribers(
  callId: string,
  kind: "call.published" | "call.changed",
): Promise<FanoutResult | null> {
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c) return null;
  const lines = [
    kind === "call.published"
      ? "Regionalny Ośrodek Polityki Społecznej w Krakowie ogłasza nabór:"
      : "Zmieniły się informacje o naborze:",
    "",
    c.name,
    c.program ? `Program: ${c.program}` : null,
    c.operator ? `Operator: ${c.operator}` : null,
    `Status: ${CALL_STATUS_LABEL[c.status]}`,
    `Termin: od ${date(c.windowFrom)} do ${date(c.windowTo)}`,
    c.amountMax ? `Maksymalna kwota: ${PLN.format(c.amountMax)}` : null,
    c.areas.length
      ? `Obszary: ${c.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")}`
      : null,
    "",
    c.sourceUrl ? `Szczegóły i dokumenty: ${c.sourceUrl}` : null,
    siteUrl() ? `Serwis Już Działa: ${siteUrl()}` : null,
  ].filter((l): l is string => l !== null);
  return deliverToSubscribers({
    topic: ["calls", ...c.areas.map((a) => `area:${a}`)],
    subject: callNoticeSubject(c.name, kind),
    text: lines.join("\n"),
  });
}

/** „innovation.published" → subscribers of the card's Mapa areas. */
export async function notifyInnovationSubscribers(
  innovationId: string,
): Promise<FanoutResult | null> {
  const [i] = await db
    .select()
    .from(innovations)
    .where(eq(innovations.id, innovationId));
  if (i?.status !== "published" || i.mapaAreas.length === 0) return null;
  const link = siteUrl()
    ? `${siteUrl()}/library/${i.slug}`
    : `/library/${i.slug}`;
  return deliverToSubscribers({
    topic: i.mapaAreas.map((a) => `area:${a}`),
    subject: `Nowe rozwiązanie w Bibliotece: ${i.title}`,
    text: [
      `W Bibliotece Innowacji Społecznych jest nowe rozwiązanie: ${i.title}.`,
      `Obszary: ${i.mapaAreas.map((a) => MAPA_AREA_LABEL[a]).join(", ")}`,
      "",
      `Przeczytaj kartę: ${link}`,
    ].join("\n"),
  });
}
