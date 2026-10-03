/**
 * Removes cases created by automated tests: sample cases whose title starts
 * with „[test]" (the e2e specs create them that way), together with their
 * thread, notifications, deliveries, outbox events and audit entries.
 * Real cases are never touched. Wired into `pnpm db:seed` by the orchestrator.
 */
import { and, eq, inArray, like, or, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  auditLog,
  cases,
  deliveries,
  events,
  messages,
  notifications,
} from "~/server/db/schema";

export async function cleanTestCases(): Promise<number> {
  const rows = await db
    .select({ id: cases.id, code: cases.code })
    .from(cases)
    .where(and(eq(cases.isSample, true), like(cases.title, "[test]%")));
  if (rows.length === 0) {
    console.log("[seed] test cases: none");
    return 0;
  }
  const ids = rows.map((r) => r.id);
  const codes = rows.map((r) => r.code);
  await db.transaction(async (tx) => {
    await tx.delete(messages).where(inArray(messages.caseId, ids));
    await tx.delete(notifications).where(
      or(
        inArray(notifications.caseId, ids),
        inArray(
          notifications.recipient,
          ids.map((id) => `case:${id}`),
        ),
      ),
    );
    await tx.delete(deliveries).where(inArray(deliveries.caseId, ids));
    await tx.delete(events).where(
      sql`${events.payload}->>'caseId' in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    await tx
      .delete(auditLog)
      .where(
        and(eq(auditLog.entity, "case"), inArray(auditLog.entityId, codes)),
      );
    await tx.delete(cases).where(inArray(cases.id, ids));
  });
  console.log(`[seed] test cases removed: ${rows.length}`);
  return rows.length;
}
