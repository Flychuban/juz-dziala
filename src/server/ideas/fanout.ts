import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { CALL_STATUS_LABEL, MAPA_AREA_LABEL, SITE } from "~/lib/domain";
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

const SIGNATURE = `Zespół Hubu ROPS\n${SITE.hub}\n${SITE.owner}`;
const UNSUBSCRIBE = "Nie chcesz tych powiadomień? Odpowiedz na tę wiadomość albo napisz do ROPS — usuniemy Twój adres.";

async function deliver(topic: string, mail: { subject: string; text: string }, sms: string): Promise<number> {
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.topic, topic), eq(subscriptions.active, true)));
  let n = 0;
  for (const s of subs) {
    const to = decrypt(s.contactEnc);
    if (!to) continue;
    if (s.channel === "email") await sendMail({ to, subject: mail.subject, text: `${mail.text}\n\n${UNSUBSCRIBE}\n\n${SIGNATURE}` });
    else await simulateSms({ to, text: sms });
    n++;
  }
  return n;
}

async function onCall(callId: string, changed: boolean) {
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c || (c.status !== "open" && c.status !== "demo")) return;
  const dates = c.windowTo ? ` Nabór trwa do ${new Date(c.windowTo).toLocaleDateString("pl-PL", { dateStyle: "long" })}.` : "";
  const link = `${siteUrl()}/network#nabory`;
  await deliver(
    "calls",
    {
      subject: `${changed ? "Zmiana w naborze" : "Nowy nabór"}: ${c.name}`,
      text: `${changed ? "Zmieniły się informacje o naborze" : "ROPS ogłosił nabór"} „${c.name}” (${CALL_STATUS_LABEL[c.status]}).${dates}\n\nSzczegóły: ${c.sourceUrl ?? link}\nWszystkie nabory: ${link}`,
    },
    `Już Działa: ${changed ? "zmiana w naborze" : "nowy nabór"} „${c.name.slice(0, 60)}”. ${link}`,
  );
}

async function onInnovation(innovationId: string) {
  const [i] = await db
    .select({ title: innovations.title, slug: innovations.slug, areas: innovations.mapaAreas })
    .from(innovations)
    .where(and(eq(innovations.id, innovationId), eq(innovations.status, "published")));
  if (!i) return;
  const link = `${siteUrl()}/library/${i.slug}`;
  for (const area of i.areas) {
    await deliver(
      `area:${area}`,
      {
        subject: `Nowe rozwiązanie w obszarze „${MAPA_AREA_LABEL[area]}”: ${i.title}`,
        text: `W Bibliotece Innowacji Społecznych pojawiło się rozwiązanie „${i.title}” w obszarze „${MAPA_AREA_LABEL[area]}”.\n\nZobacz: ${link}`,
      },
      `Już Działa: nowe rozwiązanie „${i.title.slice(0, 60)}”. ${link}`,
    );
  }
}

async function onSimilarFound(caseId: string, innovationId: string) {
  const [c] = await db.select({ id: cases.id, code: cases.code }).from(cases).where(eq(cases.id, caseId));
  const [i] = await db
    .select({ title: innovations.title, slug: innovations.slug })
    .from(innovations)
    .where(inArray(innovations.id, [innovationId]));
  if (!c || !i) return;
  await db.insert(notifications).values({
    recipient: `case:${c.id}`,
    caseId: c.id,
    kind: "idea.similarFound",
    title: `Podobne rozwiązanie już działa: ${i.title}`,
    body: "Może warto skontaktować się z jego autorami albo rozwinąć je razem?",
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
