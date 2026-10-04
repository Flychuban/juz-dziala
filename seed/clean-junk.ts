/**
 * Removes test inputs and keyboard noise from the matching log, so they never
 * show up in Trendy or as a „biała plama": real (non-sample) match runs whose
 * text fails `looksLikeGibberish` („asdsadsad", „Szukaj rozwiązań Szukaj
 * rozwiązań"). Sample runs are left to their own seed, and a run that opened
 * a case is kept (somebody asked ROPS for help from it).
 *
 * Run by `pnpm db:seed`; safe to run again.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";

import { looksLikeGibberish } from "~/server/admin/gibberish";
import { db } from "~/server/db";
import { matchRuns } from "~/server/db/schema";

export async function cleanJunkRuns(): Promise<number> {
  const rows = await db
    .select({ id: matchRuns.id, text: matchRuns.queryRedacted })
    .from(matchRuns)
    .where(and(eq(matchRuns.isSample, false), isNull(matchRuns.caseId)));
  const junk = rows.filter((r) => looksLikeGibberish(r.text)).map((r) => r.id);
  for (let i = 0; i < junk.length; i += 500) {
    await db
      .delete(matchRuns)
      .where(inArray(matchRuns.id, junk.slice(i, i + 500)));
  }
  console.log(
    `[seed] junk match runs removed: ${junk.length} of ${rows.length} real runs`,
  );
  return junk.length;
}
