import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { MapaArea } from "~/lib/domain";
import { db } from "~/server/db";
import { innovations, orgs, people, subscriptions } from "~/server/db/schema";
import { maskContact } from "~/server/domain/case-code";
import { decrypt, encrypt } from "~/server/lib/crypto";
import { normalizeSubscriptionContact } from "./network-rules";
import type { SubscriptionTopic } from "./schema";

/** Module V — /network: organisations from the library, sample mentors, subscriptions. */

export const ORG_TYPE_LABEL: Record<string, { one: string; many: string }> = {
  fundacja: { one: "Fundacja", many: "Fundacje" },
  stowarzyszenie: { one: "Stowarzyszenie", many: "Stowarzyszenia" },
  uczelnia: { one: "Uczelnia", many: "Uczelnie" },
  jst: { one: "Samorząd", many: "Samorządy (gminy, powiaty)" },
  ops: { one: "Ośrodek pomocy społecznej", many: "Ośrodki pomocy społecznej" },
  firma: { one: "Firma", many: "Firmy i spółki" },
  inna: { one: "Inna instytucja", many: "Inne instytucje" },
};
export const ORG_TYPE_ORDER = ["fundacja", "stowarzyszenie", "ops", "jst", "uczelnia", "firma", "inna"];

export type NetworkOrg = {
  id: string;
  name: string;
  type: string;
  isSample: boolean;
  sourceUrl: string | null;
  innovations: { id: string; slug: string; title: string }[];
};

export async function listOrgs(): Promise<NetworkOrg[]> {
  const rows = await db.select().from(orgs);
  const ids = [...new Set(rows.flatMap((o) => o.innovationIds))];
  const inns = ids.length
    ? await db
        .select({ id: innovations.id, slug: innovations.slug, title: innovations.title })
        .from(innovations)
        .where(and(inArray(innovations.id, ids), eq(innovations.status, "published")))
    : [];
  const byId = new Map(inns.map((i) => [i.id, i]));
  return rows
    .map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      isSample: o.isSample,
      sourceUrl: o.sourceUrl,
      innovations: o.innovationIds.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export type NetworkPerson = {
  id: string;
  displayName: string;
  role: "mentor" | "expert" | "rops";
  title: string | null;
  areas: MapaArea[];
  orgName: string | null;
  bio: string | null;
  isSample: boolean;
};

export async function listPeople(): Promise<NetworkPerson[]> {
  const rows = await db.select().from(people).where(inArray(people.role, ["mentor", "expert"]));
  return rows
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      role: p.role,
      title: p.title,
      areas: p.areas,
      orgName: p.orgName,
      bio: p.bio,
      isSample: p.isSample,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pl"));
}

/**
 * Saves a subscription with the contact encrypted (masked copy for display).
 * The same contact on the same topic is not stored twice.
 */
export async function subscribe(input: {
  topic: SubscriptionTopic;
  channel: "email" | "sms";
  contact: string;
}): Promise<{ created: boolean; masked: string }> {
  const contact = normalizeSubscriptionContact(input.channel, input.contact);
  if (!contact) throw new Error("invalid contact");
  const masked = maskContact(contact);
  const existing = await db
    .select({ id: subscriptions.id, contactEnc: subscriptions.contactEnc, active: subscriptions.active })
    .from(subscriptions)
    .where(and(eq(subscriptions.topic, input.topic), eq(subscriptions.contactMasked, masked)));
  const same = existing.find((s) => decrypt(s.contactEnc) === contact);
  if (same) {
    if (!same.active) await db.update(subscriptions).set({ active: true }).where(eq(subscriptions.id, same.id));
    return { created: false, masked };
  }
  await db.insert(subscriptions).values({
    topic: input.topic,
    channel: input.channel,
    contactEnc: encrypt(contact),
    contactMasked: masked,
  });
  return { created: true, masked };
}
