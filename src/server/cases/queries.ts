import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { CaseStatus } from "~/lib/domain";
import type { StaffSession } from "~/server/auth/session";
import { db } from "~/server/db";
import { cases, events, messages } from "~/server/db/schema";
import { normalizeCaseCode } from "~/server/domain/case-code";

export type CaseRow = typeof cases.$inferSelect;

export async function findCaseByCode(raw: string): Promise<CaseRow | null> {
  const code = normalizeCaseCode(raw);
  if (!code) return null;
  const [row] = await db.select().from(cases).where(eq(cases.code, code));
  return row ?? null;
}

/** In-app recipient key for a staff session. */
export function staffRecipient(s: StaffSession): string {
  return s.role === "rops" ? "rops" : `expert:${s.personId}`;
}

export type TimelineStep = {
  status: CaseStatus;
  reached: boolean;
  current: boolean;
  at: Date | null;
};

const ORDER: CaseStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "answered",
  "closed",
];

/**
 * Przyjęta → Wstępnie oceniona → W toku → Odpowiedziano (→ Zamknięta).
 * Dates come from the outbox: the first time each status was reached.
 */
export async function timelineFor(c: CaseRow): Promise<TimelineStep[]> {
  const rows = await db
    .select({
      type: events.type,
      payload: events.payload,
      at: events.createdAt,
    })
    .from(events)
    .where(
      and(
        inArray(events.type, ["case.created", "case.triaged", "case.status"]),
        sql`${events.payload}->>'caseId' = ${c.id}`,
      ),
    )
    .orderBy(asc(events.createdAt));
  const firstAt = new Map<CaseStatus, Date>();
  firstAt.set("new", c.createdAt);
  for (const r of rows) {
    const status: CaseStatus | null =
      r.type === "case.triaged"
        ? "triaged"
        : r.type === "case.status"
          ? ((r.payload as { status?: CaseStatus }).status ?? null)
          : null;
    if (status && !firstAt.has(status)) firstAt.set(status, r.at);
  }
  const idx = ORDER.indexOf(c.status);
  const steps = ORDER.filter((s) => s !== "closed" || c.status === "closed");
  return steps.map((s, i) => ({
    status: s,
    reached: i <= idx,
    current: i === idx,
    at: i <= idx ? (firstAt.get(s) ?? null) : null,
  }));
}

/** Messages the author may see, oldest first. */
export async function authorMessages(caseId: string) {
  return db
    .select({
      id: messages.id,
      authorKind: messages.authorKind,
      authorName: messages.authorName,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.caseId, caseId), eq(messages.visibleToAuthor, true)))
    .orderBy(asc(messages.createdAt));
}
