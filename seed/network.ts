import { existsSync, readFileSync } from "node:fs";

import { db } from "~/server/db";
import { calls, innovationSites, orgs } from "~/server/db/schema";
import type { CallStatus, MapaArea } from "~/lib/domain";
import type { Criterion, FormField } from "~/server/db/schema";

type CallJson = {
  id: string;
  name: string;
  program: string | null;
  operator: string | null;
  amountMax: number | null;
  amountAvg: number | null;
  window: { from: string | null; to: string | null };
  status: CallStatus;
  eligibility: string[];
  formFields: FormField[];
  criteria: Criterion[];
  minScore: number | null;
  areas?: MapaArea[];
  sourceUrl: string | null;
  notes: string | null;
};

const overwrite = process.env.SEED_OVERWRITE === "1";

/** Grant calls from data/calls.json (ROPS sources). Never overwrites staff edits unless SEED_OVERWRITE=1. */
export async function seedCalls() {
  if (!existsSync("data/calls.json")) return;
  const rows = JSON.parse(
    readFileSync("data/calls.json", "utf8"),
  ) as CallJson[];
  for (const c of rows) {
    const row = {
      id: c.id,
      name: c.name,
      program: c.program,
      operator: c.operator,
      amountMax: c.amountMax,
      amountAvg: c.amountAvg,
      windowFrom: c.window.from,
      windowTo: c.window.to,
      status: c.status,
      eligibility: c.eligibility ?? [],
      formFields: c.formFields ?? [],
      criteria: c.criteria ?? [],
      minScore: c.minScore,
      areas: c.areas ?? [],
      sourceUrl: c.sourceUrl,
      notes: c.notes,
    };
    const q = db.insert(calls).values(row);
    await (overwrite
      ? q.onConflictDoUpdate({ target: calls.id, set: row })
      : q.onConflictDoNothing());
  }
  console.log(`[seed] calls: ${rows.length}`);
}

type NetworkJson = {
  orgs: {
    id: string;
    name: string;
    type: string;
    innovationIds: string[];
    isSample: boolean;
    sourceUrl: string | null;
  }[];
  sites: {
    innovationId: string;
    place: string;
    sentenceId: string | null;
    isSample: boolean;
  }[];
};

/** Organisations named in library cards (real, public) and any stated test sites. */
export async function seedNetwork() {
  if (!existsSync("data/network.json")) return;
  const n = JSON.parse(
    readFileSync("data/network.json", "utf8"),
  ) as NetworkJson;
  for (const o of n.orgs) {
    const row = { ...o, gminaTeryt: null };
    await db
      .insert(orgs)
      .values(row)
      .onConflictDoUpdate({ target: orgs.id, set: row });
  }
  if (n.sites.length > 0) {
    await db.delete(innovationSites).where(eqFalse());
    for (const s of n.sites) {
      await db.insert(innovationSites).values({ ...s, stage: "test" });
    }
  }
  console.log(`[seed] orgs: ${n.orgs.length}, sites: ${n.sites.length}`);
}

import { eq } from "drizzle-orm";
function eqFalse() {
  return eq(innovationSites.isSample, false);
}
