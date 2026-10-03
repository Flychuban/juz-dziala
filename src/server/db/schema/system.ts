import { index } from "drizzle-orm/pg-core";

import { createTable } from "./_table";

/**
 * In-app notifications. `recipient` is "rops", "expert:<personId>" or
 * "case:<caseId>" (the author, shown on the case page).
 */
export const notifications = createTable(
  "notification",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    recipient: d.text().notNull(),
    caseId: d.uuid(),
    kind: d.text().notNull(),
    title: d.text().notNull(),
    body: d.text(),
    href: d.text(),
    readAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [index("notification_recipient_idx").on(t.recipient, t.readAt)],
);

/** Outbound deliveries (e-mail real; SMS simulated in the prototype). */
export const deliveries = createTable("delivery", (d) => ({
  id: d.uuid().primaryKey().defaultRandom(),
  channel: d.text().$type<"email" | "sms" | "phone">().notNull(),
  toMasked: d.text().notNull(),
  subject: d.text(),
  body: d.text().notNull(),
  status: d
    .text()
    .$type<"sent" | "simulated" | "failed" | "skipped">()
    .notNull(),
  error: d.text(),
  caseId: d.uuid(),
  createdAt: d
    .timestamp({ withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
}));

/** „Powiadom mnie o nowych naborach / innowacjach w obszarze X". */
export const subscriptions = createTable("subscription", (d) => ({
  id: d.uuid().primaryKey().defaultRandom(),
  /** "calls" or "area:<MapaArea>" */
  topic: d.text().notNull(),
  channel: d.text().$type<"email" | "sms">().notNull(),
  contactEnc: d.text().notNull(),
  contactMasked: d.text().notNull(),
  active: d.boolean().notNull().default(true),
  createdAt: d
    .timestamp({ withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
}));

/** Outbox of domain events — ready for webhooks to other Hub systems. */
export const events = createTable(
  "event",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    type: d.text().notNull(),
    payload: d.jsonb().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    processedAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [index("event_type_idx").on(t.type)],
);

/** Every Claude call: cost, latency, cache — the basis of KOSZTY.md. */
export const aiCalls = createTable(
  "ai_call",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    fn: d.text().notNull(),
    model: d.text().notNull(),
    effort: d.text(),
    inputTokens: d.integer().notNull().default(0),
    cacheReadTokens: d.integer().notNull().default(0),
    cacheWriteTokens: d.integer().notNull().default(0),
    outputTokens: d.integer().notNull().default(0),
    latencyMs: d.integer().notNull(),
    ok: d.boolean().notNull(),
    stopReason: d.text(),
    error: d.text(),
    costUsd: d.doublePrecision().notNull().default(0),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [index("ai_call_fn_idx").on(t.fn, t.createdAt)],
);

export const auditLog = createTable("audit_log", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  actor: d.text().notNull(),
  action: d.text().notNull(),
  entity: d.text().notNull(),
  entityId: d.text().notNull(),
  diff: d.jsonb(),
  createdAt: d
    .timestamp({ withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
}));

/** Fixed-window rate limiting keyed by session (not IP: judges share one). */
export const rateLimits = createTable("rate_limit", (d) => ({
  key: d.text().primaryKey(),
  windowStart: d.timestamp({ withTimezone: true }).notNull(),
  count: d.integer().notNull().default(0),
}));
