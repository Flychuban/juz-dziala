import { index, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  AuthorRole,
  CaseKind,
  CaseStatus,
  ContactPref,
  MapaArea,
  MessageAuthorKind,
  Urgency,
} from "~/lib/domain";
import { createTable } from "./_table";

/**
 * Every matchmaking run, saved anonymously (redacted text only).
 * Backs /match/[id], the admin trends and „Białe plamy".
 */
export const matchRuns = createTable(
  "match_run",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    queryRedacted: d.text().notNull(),
    gminaTeryt: d.text(),
    powiatTeryt: d.text(),
    areas: d.text().array().$type<MapaArea[]>().notNull().default([]),
    /** Instant keyword result (always present). */
    keywordResult: d.jsonb().notNull(),
    /** Verified AI result, when it arrived. */
    aiResult: d.jsonb(),
    status: d
      .text()
      .$type<"keyword" | "ai" | "abstained" | "error">()
      .notNull()
      .default("keyword"),
    crisis: d.boolean().notNull().default(false),
    abstained: d.boolean().notNull().default(false),
    /** Language the person used the site in ("pl" | "en"). */
    locale: d.text().$type<"pl" | "en">().notNull().default("pl"),
    caseId: d.uuid(),
    sessionId: d.text(),
    isSample: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [index("match_run_created_idx").on(t.createdAt)],
);

/** The „Sprawa": one engine for needs, ideas, questions, tests, feedback, adaptations. */
export const cases = createTable(
  "case",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    /** Human code, e.g. JD-7K3Q-X9MP. Shown large and printable. */
    code: d.text().notNull(),
    /** sha256 of the private-link token. */
    tokenHash: d.text().notNull(),
    kind: d.text().$type<CaseKind>().notNull(),
    title: d.text().notNull(),
    bodyRedacted: d.text().notNull(),
    gminaTeryt: d.text(),
    powiatTeryt: d.text(),
    areas: d.text().array().$type<MapaArea[]>().notNull().default([]),
    urgency: d.text().$type<Urgency>(),
    status: d.text().$type<CaseStatus>().notNull().default("new"),
    /** people.id of the assigned expert/mentor, or "rops". */
    assigneeId: d.text(),
    authorRole: d.text().$type<AuthorRole>().notNull().default("resident"),
    /** „Zgłaszam w imieniu" — reported on behalf of someone. */
    onBehalf: d.boolean().notNull().default(false),
    contactPref: d.text().$type<ContactPref>().notNull().default("none"),
    /** The author's language ("pl" | "en"): replies, receipts and drafts use it. */
    locale: d.text().$type<"pl" | "en">().notNull().default("pl"),
    /** AES-GCM encrypted contact; staff-only. */
    contactEnc: d.text(),
    /** Masked contact for display, e.g. j***@g***.com */
    contactMasked: d.text(),
    matchRunId: d.uuid(),
    /** Module payloads. */
    triage: d.jsonb(),
    idea: d.jsonb(),
    canvas: d.jsonb(),
    plan: d.jsonb(),
    innovationId: d.text(),
    callId: d.text(),
    rating: d.integer(),
    isSample: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    lastActivityAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [
    uniqueIndex("case_code_idx").on(t.code),
    index("case_status_idx").on(t.status),
    index("case_kind_idx").on(t.kind),
    index("case_assignee_idx").on(t.assigneeId),
  ],
);

/** The case thread. */
export const messages = createTable(
  "message",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    caseId: d.uuid().notNull(),
    authorKind: d.text().$type<MessageAuthorKind>().notNull(),
    authorName: d.text(),
    body: d.text().notNull(),
    /** Internal staff notes are hidden from the author. */
    visibleToAuthor: d.boolean().notNull().default(true),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  }),
  (t) => [index("message_case_idx").on(t.caseId)],
);
