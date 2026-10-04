import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { formatDate } from "~/components/kit/format";
import { translatorFor } from "~/i18n/server";
import { labelsFor } from "~/lib/domain";
import { db } from "~/server/db";
import { calls, cases, innovations, notifications, subscriptions } from "~/server/db/schema";
import { decrypt } from "~/server/lib/crypto";
import { sendMail, simulateSms } from "~/server/mail/send";
import { siteUrl } from "~/server/mail/templates";

/**
 * Fan-out of the events modules III–V own, ready to be called from
 * `notify-fanout.ts` (owned by the Sprawy agent), whose switch has a TODO for
 * exactly these four:
 *
 *   case "call.published": case "call.changed":
 *   case "innovation.published": case "idea.similarFound":
 *     return ideasFanout(ev);
 *
 * Subscribers get an e-mail (real when a transport is configured) or a
 * simulated SMS; every attempt is recorded in jd_delivery with the contact
 * masked. The idea author gets an in-app note on their case page.
 */
export type IdeasFanoutEvent =
  | { type: "call.published"; callId: string }
  | { type: "call.changed"; callId: string }
  | { type: "innovation.published"; innovationId: string }
  | { type: "idea.similarFound"; caseId: string; innovationId: string };

/**
 * Subscriptions store no language, so mail to subscribers is Polish (the
 * default); the author's in-app note carries both languages.
 */
const MAIL_LOCALE = "pl" as const;

async function deliver(topic: string, mail: { subject: string; text: string }, sms: string): Promise<number> {
  const t = translatorFor(MAIL_LOCALE, "ideas");
  const site = labelsFor(MAIL_LOCALE).site;
  const footer = `${t("fanout.unsubscribe")}\n\n${t("fanout.signature", { hub: site.hub, owner: site.owner })}`;
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.topic, topic), eq(subscriptions.active, true)));
  let n = 0;
  for (const s of subs) {
    const to = decrypt(s.contactEnc);
    if (!to) continue;
    if (s.channel === "email") await sendMail({ to, subject: mail.subject, text: `${mail.text}\n\n${footer}` });
    else await simulateSms({ to, text: sms });
    n++;
  }
  return n;
}

async function onCall(callId: string, changed: boolean) {
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c || (c.status !== "open" && c.status !== "demo")) return;
  const tr = translatorFor(MAIL_LOCALE, "ideas");
  const t = (k: "until" | "subject" | "text" | "links" | "sms", v: Record<string, string>) => tr(`fanout.call.${k}`, v);
  const kind = changed ? "changed" : "new";
  const dates = c.windowTo ? ` ${t("until", { date: formatDate(c.windowTo, MAIL_LOCALE) })}` : "";
  const link = `${siteUrl()}/network#nabory`;
  await deliver(
    "calls",
    {
      subject: t("subject", { kind, name: c.name }),
      text: `${t("text", { kind, name: c.name, status: labelsFor(MAIL_LOCALE).callStatus[c.status] })}${dates}\n\n${t("links", { details: c.sourceUrl ?? link, all: link })}`,
    },
    t("sms", { kind, name: c.name.slice(0, 60), link }),
  );
}

async function onInnovation(innovationId: string) {
  const [i] = await db
    .select({ title: innovations.title, slug: innovations.slug, areas: innovations.mapaAreas })
    .from(innovations)
    .where(and(eq(innovations.id, innovationId), eq(innovations.status, "published")));
  if (!i) return;
  const tr = translatorFor(MAIL_LOCALE, "ideas");
  const t = (k: "subject" | "text" | "sms", v: Record<string, string>) => tr(`fanout.innovation.${k}`, v);
  const link = `${siteUrl()}/library/${i.slug}`;
  for (const area of i.areas) {
    const areaLabel = labelsFor(MAIL_LOCALE).area[area];
    await deliver(
      `area:${area}`,
      {
        subject: t("subject", { area: areaLabel, title: i.title }),
        text: t("text", { area: areaLabel, title: i.title, link }),
      },
      t("sms", { title: i.title.slice(0, 60), link }),
    );
  }
}

async function onSimilarFound(caseId: string, innovationId: string) {
  const [c] = await db.select({ id: cases.id, code: cases.code }).from(cases).where(eq(cases.id, caseId));
  const [i] = await db
    .select({ title: innovations.title, slug: innovations.slug, en: innovations.en })
    .from(innovations)
    .where(inArray(innovations.id, [innovationId]));
  if (!c || !i) return;
  const pl = translatorFor("pl", "ideas");
  const en = translatorFor("en", "ideas");
  await db.insert(notifications).values({
    recipient: `case:${c.id}`,
    caseId: c.id,
    kind: "idea.similarFound",
    title: pl("fanout.similar.title", { title: i.title }),
    body: pl("fanout.similar.body"),
    en: { title: en("fanout.similar.title", { title: i.en?.title ?? i.title }), body: en("fanout.similar.body") },
    href: `/library/${i.slug}`,
  });
}

export async function ideasFanout(ev: IdeasFanoutEvent): Promise<void> {
  switch (ev.type) {
    case "call.published":
      return onCall(ev.callId, false);
    case "call.changed":
      return onCall(ev.callId, true);
    case "innovation.published":
      return onInnovation(ev.innovationId);
    case "idea.similarFound":
      return onSimilarFound(ev.caseId, ev.innovationId);
  }
}
