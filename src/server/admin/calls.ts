import "server-only";

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { CALL_STATUSES, mapaAreaSchema } from "~/lib/domain";
import { type Db } from "~/server/db";
import { auditLog, calls, deliveries, events } from "~/server/db/schema";
import { notify } from "~/server/notify";
import {
  callNoticeSubject,
  notifyCallSubscribers,
  type SubscriberDelivery,
} from "~/server/subscriptions/fanout";
import { slugify } from "./library";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data w formacie RRRR-MM-DD.")
  .nullable();
const money = z.number().int().min(0).max(100_000_000).nullable();

export const callInputSchema = z
  .object({
    name: z.string().trim().min(5, "Nazwa jest za krótka.").max(400),
    program: z.string().trim().max(400).nullable(),
    operator: z.string().trim().max(400).nullable(),
    amountMax: money,
    amountAvg: money,
    windowFrom: isoDate,
    windowTo: isoDate,
    status: z.enum(CALL_STATUSES),
    eligibility: z.array(z.string().trim().min(1).max(500)).max(30),
    areas: z.array(mapaAreaSchema).max(8),
    sourceUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => v === "" || /^https?:\/\/\S+$/.test(v),
        "Podaj pełny adres (https://…).",
      )
      .nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .refine((c) => !c.windowFrom || !c.windowTo || c.windowFrom <= c.windowTo, {
    message: "Koniec naboru nie może być przed jego początkiem.",
    path: ["windowTo"],
  });
export type CallInput = z.infer<typeof callInputSchema>;

type CallRow = typeof calls.$inferSelect;

/** Empty or whitespace-only text is stored as null. */
const orNull = (s: string | null) => (s?.trim() ? s.trim() : null);

export async function listCalls(db: Db) {
  return db
    .select()
    .from(calls)
    .orderBy(sql`${calls.windowFrom} desc nulls last`, asc(calls.name));
}

function diffOf(
  before: Partial<CallRow> | undefined,
  after: Record<string, unknown>,
) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(after)) {
    const prev = before?.[k as keyof CallRow] ?? null;
    if (JSON.stringify(prev) !== JSON.stringify(v ?? null))
      diff[k] = { from: prev, to: v ?? null };
  }
  return diff;
}

/** Creates (id = null) or updates a call. Changes are live at once; subscribers are told only on publish. */
export async function saveCall(
  db: Db,
  actor: string,
  id: string | null,
  input: CallInput,
): Promise<{ id: string; created: boolean; changed: string[] }> {
  const row = {
    name: input.name,
    program: orNull(input.program),
    operator: orNull(input.operator),
    amountMax: input.amountMax,
    amountAvg: input.amountAvg,
    windowFrom: input.windowFrom,
    windowTo: input.windowTo,
    status: input.status,
    eligibility: input.eligibility,
    areas: [...new Set(input.areas)],
    sourceUrl: orNull(input.sourceUrl),
    notes: orNull(input.notes),
  };
  let before: CallRow | undefined;
  let callId = id;
  if (callId) {
    [before] = await db.select().from(calls).where(eq(calls.id, callId));
    if (!before) throw new Error("Nie znaleziono naboru.");
    await db
      .update(calls)
      .set({ ...row, updatedAt: new Date() })
      .where(eq(calls.id, callId));
  } else {
    const ids = new Set(
      (await db.select({ id: calls.id }).from(calls)).map((r) => r.id),
    );
    const base = slugify(input.name).slice(0, 48).replace(/-+$/, "") || "nabor";
    callId = base;
    for (let i = 2; ids.has(callId); i++) callId = `${base}-${i}`;
    await db.insert(calls).values({ id: callId, ...row });
  }
  const diff = diffOf(before, row);
  await db.insert(auditLog).values({
    actor,
    action: before ? "call.update" : "call.create",
    entity: "call",
    entityId: callId,
    diff,
  });
  return { id: callId, created: !before, changed: Object.keys(diff) };
}

export type PublishResult = {
  kind: "call.published" | "call.changed";
  subject: string;
  deliveries: SubscriberDelivery[];
};

/**
 * „Opublikuj zmiany": announces the call through notify() — "call.published"
 * the first time, "call.changed" afterwards — and returns the deliveries the
 * notice produced. Until notify-fanout is wired to the subscriptions fan-out,
 * the notice is sent from here; once it is wired, the deliveries written by
 * the fan-out are found and nothing is sent twice.
 */
export async function publishCall(
  db: Db,
  actor: string,
  callId: string,
): Promise<PublishResult | null> {
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c) return null;
  const [prior] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.type, "call.published"),
        sql`${events.payload}->>'callId' = ${callId}`,
      ),
    )
    .limit(1);
  const kind = prior ? "call.changed" : "call.published";
  const subject = callNoticeSubject(c.name, kind);
  const startedAt = new Date(Date.now() - 1000);

  await notify({ type: kind, callId });

  const found = async () =>
    db
      .select({
        channel: deliveries.channel,
        toMasked: deliveries.toMasked,
        status: deliveries.status,
        error: deliveries.error,
      })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.subject, subject),
          gte(deliveries.createdAt, startedAt),
        ),
      )
      .orderBy(asc(deliveries.createdAt));

  let rows = await found();
  if (rows.length === 0) {
    // Fan-out not wired yet (or no subscribers): send from here.
    await notifyCallSubscribers(callId, kind);
    rows = await found();
  }
  await db.insert(auditLog).values({
    actor,
    action: kind,
    entity: "call",
    entityId: callId,
    diff: { notified: rows.length },
  });
  return {
    kind,
    subject,
    deliveries: rows.map((r) => ({
      channel: r.channel === "sms" ? "sms" : "email",
      toMasked: r.toMasked,
      status: r.status,
      error: r.error,
    })),
  };
}

/** Latest call notices (deliveries whose subject is a call notice). */
export async function recentCallDeliveries(db: Db, limit = 30) {
  return db
    .select()
    .from(deliveries)
    .where(
      sql`${deliveries.subject} like 'Nowy nabór:%' or ${deliveries.subject} like 'Zmiana w naborze:%'`,
    )
    .orderBy(desc(deliveries.createdAt))
    .limit(limit);
}
