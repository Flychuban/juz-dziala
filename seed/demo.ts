import { and, eq, inArray } from "drizzle-orm";

import { db } from "~/server/db";
import { innovations } from "~/server/db/schema";

/**
 * Demo flags: a few real innovations are open for testers so module IV has
 * something to show. Idempotent; never closes what staff opened.
 */
const OPEN_FOR_TESTING = [
  "merkury",
  "senior-cuder",
  "inteligentny-organizer-do-lekow",
];

export async function seedDemoFlags() {
  await db
    .update(innovations)
    .set({ testingOpen: true })
    .where(
      and(
        inArray(innovations.slug, OPEN_FOR_TESTING),
        eq(innovations.testingOpen, false),
      ),
    );
  console.log(
    `[seed] demo: ${OPEN_FOR_TESTING.length} innovations open for testers`,
  );
}
