import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { env } from "~/env";
import { formatDate } from "~/components/kit/format";
import type { Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { labelsFor } from "~/lib/domain";
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

/**
 * Subscriptions store no language yet (jd_subscription has no `locale`), so
 * notices go out in Polish. With a `locale` column, pass it here per row.
 */
const LOCALE: Locale = "pl";
const t = () => translatorFor(LOCALE, "mail");

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
  const body = `${opts.text.trim()}\n\n—\n${t()("subscriptions.signature")}`;
  for (const s of subs) {
    const contact = decrypt(s.contactEnc);
    const key = `${s.channel}:${contact ?? s.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!contact) {
      const error = t()("subscriptions.unreadable");
      await db.insert(deliveries).values({
        channel: s.channel,
        toMasked: s.contactMasked,
        subject: opts.subject,
        body,
        status: "failed",
        error,
      });
      out.push({
        channel: s.channel,
        toMasked: s.contactMasked,
        status: "failed",
        error,
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
const PLN = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const date = (d: string | null) =>
  d ? formatDate(`${d}T12:00:00Z`, LOCALE) : t()("subscriptions.toFill");

/** The subject line of a call notice (also used to find its deliveries). */
export function callNoticeSubject(
  name: string,
  kind: "call.published" | "call.changed",
) {
  const short = name.length > 90 ? `${name.slice(0, 89).trimEnd()}…` : name;
  return t()(
    kind === "call.published"
      ? "subscriptions.call.subjectPublished"
      : "subscriptions.call.subjectChanged",
    { name: short },
  );
}

/** „call.published" / „call.changed" → subscribers of "calls" and of the call's areas. */
export async function notifyCallSubscribers(
  callId: string,
  kind: "call.published" | "call.changed",
): Promise<FanoutResult | null> {
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c) return null;
  const tt = t();
  const l = labelsFor(LOCALE);
  const lines = [
    tt(
      kind === "call.published"
        ? "subscriptions.call.published"
        : "subscriptions.call.changed",
    ),
    "",
    c.name,
    c.program ? tt("subscriptions.call.program", { v: c.program }) : null,
    c.operator ? tt("subscriptions.call.operator", { v: c.operator }) : null,
    tt("subscriptions.call.status", { v: l.callStatus[c.status] }),
    tt("subscriptions.call.window", {
      from: date(c.windowFrom),
      to: date(c.windowTo),
    }),
    c.amountMax
      ? tt("subscriptions.call.amount", { v: PLN.format(c.amountMax) })
      : null,
    c.areas.length
      ? tt("subscriptions.areas", {
          v: c.areas.map((a) => l.area[a]).join(", "),
        })
      : null,
    "",
    c.sourceUrl
      ? tt("subscriptions.call.details", { url: c.sourceUrl })
      : null,
    siteUrl() ? tt("subscriptions.site", { url: siteUrl() }) : null,
  ].filter((x): x is string => x !== null);
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
  const tt = t();
  const l = labelsFor(LOCALE);
  return deliverToSubscribers({
    topic: i.mapaAreas.map((a) => `area:${a}`),
    subject: tt("subscriptions.innovation.subject", { title: i.title }),
    text: [
      tt("subscriptions.innovation.intro", { title: i.title }),
      tt("subscriptions.areas", {
        v: i.mapaAreas.map((a) => l.area[a]).join(", "),
      }),
      "",
      tt("subscriptions.innovation.read", { url: link }),
    ].join("\n"),
  });
}
