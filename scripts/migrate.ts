/**
 * Explicit, idempotent schema additions run by `vercel-build` before the seed.
 *
 * `drizzle-kit push --force` stops at its first failing statement, and on the
 * production database it fails on an unrelated primary-key change it cannot
 * make ("column "id" is in a primary key"), so later additions never land.
 * Every statement here only ADDS (IF NOT EXISTS) — nothing is dropped or
 * rewritten — so it is safe to run on every deploy.
 */
import { sql } from "drizzle-orm";

import { db } from "~/server/db";

const STATEMENTS = [
  // English version (4 Oct 2026)
  sql`ALTER TABLE jd_innovation ADD COLUMN IF NOT EXISTS en jsonb`,
  sql`ALTER TABLE jd_innovation ADD COLUMN IF NOT EXISTS "easyTextEn" text`,
  sql`ALTER TABLE jd_call ADD COLUMN IF NOT EXISTS en jsonb`,
  sql`ALTER TABLE jd_case ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pl'`,
  sql`ALTER TABLE jd_match_run ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pl'`,
  sql`ALTER TABLE jd_notification ADD COLUMN IF NOT EXISTS en jsonb`,
];

async function main() {
  for (const s of STATEMENTS) await db.execute(s);
  console.log(`[migrate] ${STATEMENTS.length} additive statements applied (idempotent)`);
  process.exit(0);
}

void main().catch((e: unknown) => {
  console.error("[migrate] failed", e);
  process.exit(1);
});
