/**
 * Removes what automated tests leave behind, so the jury never sees it:
 *  - sample cases whose title starts with „[test]" (the e2e specs create them so);
 *  - match runs (and the help-request cases opened from them) whose text is
 *    exactly one of the fixed e2e / screenshot queries below.
 * Together with their thread, notifications, deliveries, outbox events and
 * audit entries. Other cases are never touched. Runs on every `pnpm db:seed`;
 * `pnpm exec tsx --env-file=<env> seed/clean-tests.ts` runs it alone.
 */
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import { db } from "~/server/db";
import {
  auditLog,
  cases,
  deliveries,
  events,
  matchRuns,
  messages,
  notifications,
} from "~/server/db/schema";

/** The fixed inputs of tests/e2e and scripts/screenshots.ts (after redaction they are unchanged). */
export const TEST_QUERIES = [
  "Mama ma 73 lata, mieszka sama na wsi i prawie nie wychodzi z domu, myli leki.",
  "Mama ma 73 lata, owdowiała, mieszka sama pod Limanową, prawie nie wychodzi z domu i myli leki.",
  "My mum is 80, lives alone in a village, hardly leaves the house and mixes up her pills.",
];

export async function cleanTestCases(): Promise<number> {
  const runs = await db
    .select({ id: matchRuns.id })
    .from(matchRuns)
    .where(and(eq(matchRuns.isSample, false), inArray(matchRuns.queryRedacted, TEST_QUERIES)));
  const runIds = runs.map((r) => r.id);
  const rows = await db
    .select({ id: cases.id, code: cases.code })
    .from(cases)
    .where(
      or(
        and(eq(cases.isSample, true), like(cases.title, "[test]%")),
        runIds.length ? inArray(cases.matchRunId, runIds) : sql`false`,
      ),
    );
  if (runIds.length) await db.delete(matchRuns).where(inArray(matchRuns.id, runIds));
  if (rows.length === 0) {
    console.log(`[seed] test cases: none (test match runs removed: ${runIds.length})`);
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
  console.log(`[seed] test cases removed: ${rows.length}, test match runs: ${runIds.length}`);
  return rows.length;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void cleanTestCases().then(() => process.exit(0));
}
