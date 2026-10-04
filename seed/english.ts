import { existsSync, readFileSync } from "node:fs";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { calls, innovations, type CallEn, type InnovationEn } from "~/server/db/schema";

/**
 * Loads the English sidecars (scripts/translate-data.ts) into jd_innovation.en
 * and jd_call.en. Always refreshed: the translation is derived data, and a card
 * whose Polish text staff later edit is detected as stale by its sourceSha.
 */
export async function seedEnglish() {
  let cards = 0;
  if (existsSync("data/library.en.json")) {
    const en = JSON.parse(readFileSync("data/library.en.json", "utf8")) as Record<string, InnovationEn>;
    for (const [id, value] of Object.entries(en)) {
      await db.update(innovations).set({ en: value }).where(eq(innovations.id, id));
      cards++;
    }
  }
  let n = 0;
  if (existsSync("data/calls.en.json")) {
    const rows = JSON.parse(readFileSync("data/calls.en.json", "utf8")) as (CallEn & { id: string })[];
    for (const c of rows) {
      const value: CallEn = {
        name: c.name,
        program: c.program ?? null,
        operator: c.operator ?? null,
        eligibility: c.eligibility ?? [],
        formFields: c.formFields ?? [],
        criteria: c.criteria ?? [],
        notes: c.notes ?? null,
      };
      await db.update(calls).set({ en: value }).where(eq(calls.id, c.id));
      n++;
    }
  }
  console.log(`[seed] english: ${cards} cards, ${n} calls`);
}
