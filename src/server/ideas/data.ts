import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { calls } from "~/server/db/schema";
import type { CanvasDef } from "./canvas-def";

/**
 * Reference data for the Kreator / Tester / Sieć modules: gminas (GUS + PRG,
 * data/gminas.json), the INNO AGH canvas (data/canvas.json) and grant calls
 * (DB table seeded from data/calls.json, editable by ROPS).
 */
async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", file), "utf8")) as unknown;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ gminas

export type GminaOption = { teryt: string; name: string; kind: string; powiatTeryt: string };
export type PowiatOption = { teryt: string; name: string };

const gminaRow = z.object({ teryt: z.string(), name: z.string(), kind: z.string(), powiatTeryt: z.string() });
const powiatRow = z.object({ teryt: z.string(), name: z.string() });

let gminaCache: { gminas: GminaOption[]; powiaty: PowiatOption[] } | null = null;

/** 183 Małopolska gminas grouped by the 22 powiats (empty lists if the files are missing). */
export async function gminaOptions(): Promise<{ gminas: GminaOption[]; powiaty: PowiatOption[] }> {
  if (gminaCache) return gminaCache;
  const g = z.array(gminaRow).safeParse(await readJson("gminas.json"));
  const p = z.array(powiatRow).safeParse(await readJson("powiaty.json"));
  const gminas = g.success
    ? g.data.map(({ teryt, name, kind, powiatTeryt }) => ({ teryt, name, kind, powiatTeryt })).sort((a, b) => a.name.localeCompare(b.name, "pl"))
    : [];
  const powiaty = p.success ? p.data.map(({ teryt, name }) => ({ teryt, name })).sort((a, b) => a.name.replace(/^powiat /, "").localeCompare(b.name.replace(/^powiat /, ""), "pl")) : [];
  gminaCache = { gminas, powiaty };
  return gminaCache;
}

export async function isKnownGmina(teryt: string | undefined): Promise<boolean> {
  if (!teryt) return true;
  const { gminas } = await gminaOptions();
  return gminas.length === 0 || gminas.some((g) => g.teryt === teryt);
}

// ------------------------------------------------------------------ canvas

const optionSchema = z.object({ label: z.string(), description: z.string().nullable() });
const canvasSchema = z.object({
  source: z.object({
    title: z.string(),
    url: z.string(),
    publisher: z.string(),
    basedOn: z.string(),
    version: z.string().nullable(),
    versionDate: z.string().nullable(),
    capturedAt: z.string(),
  }),
  sheets: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      page: z.number(),
      sections: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          prompt: z.string().nullable(),
          subfields: z.array(z.string()),
          fields: z.array(
            z.object({
              key: z.string(),
              label: z.string(),
              prompt: z.string().nullable(),
              kind: z.enum(["single", "multi", "text", "matrix"]),
              options: z.array(optionSchema),
              questions: z.array(z.string()),
            }),
          ),
        }),
      ),
    }),
  ),
});

let canvasCache: CanvasDef | null = null;
export async function loadCanvasDef(): Promise<CanvasDef | null> {
  if (canvasCache) return canvasCache;
  const r = canvasSchema.safeParse(await readJson("canvas.json"));
  if (!r.success) return null;
  canvasCache = r.data;
  return canvasCache;
}

// ------------------------------------------------------------------ calls

/** The richer criterion shape stored by the seed (data/calls.json). */
export const callCriterionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().nullish(),
  cardDescription: z.string().nullish(),
  min: z.number().default(0),
  max: z.number(),
  minToPass: z.number().nullish(),
});
export type CallCriterion = z.infer<typeof callCriterionSchema>;
const formFieldSchema = z.object({ key: z.string(), label: z.string(), hint: z.string().nullish() });

export type CallInfo = {
  id: string;
  name: string;
  program: string | null;
  operator: string | null;
  amountMax: number | null;
  amountAvg: number | null;
  windowFrom: string | null;
  windowTo: string | null;
  status: "planned" | "open" | "closed" | "demo";
  eligibility: string[];
  formFields: { key: string; label: string; hint: string | null }[];
  criteria: CallCriterion[];
  minScore: number | null;
  sourceUrl: string | null;
  notes: string | null;
};

function toCallInfo(row: typeof calls.$inferSelect): CallInfo {
  const criteria = z.array(callCriterionSchema).safeParse(row.criteria);
  const fields = z.array(formFieldSchema).safeParse(row.formFields);
  return {
    id: row.id,
    name: row.name,
    program: row.program,
    operator: row.operator,
    amountMax: row.amountMax,
    amountAvg: row.amountAvg,
    windowFrom: row.windowFrom,
    windowTo: row.windowTo,
    status: row.status,
    eligibility: row.eligibility,
    formFields: fields.success ? fields.data.map((f) => ({ key: f.key, label: f.label, hint: f.hint ?? null })) : [],
    criteria: criteria.success ? criteria.data : [],
    minScore: row.minScore,
    sourceUrl: row.sourceUrl,
    notes: row.notes,
  };
}

/** Calls that are open now (status open or demo), soonest deadline first. */
export async function openCalls(): Promise<CallInfo[]> {
  const rows = await db.select().from(calls).where(inArray(calls.status, ["open", "demo"]));
  return rows
    .map(toCallInfo)
    .sort((a, b) => (a.windowTo ?? "9999").localeCompare(b.windowTo ?? "9999") || a.name.localeCompare(b.name, "pl"));
}

/**
 * The call a resident's application is written for: an open or demo call that
 * publishes its form (formFields). Real open calls win over the demo one.
 */
export async function applicationCall(): Promise<CallInfo | null> {
  const open = (await openCalls()).filter((c) => c.formFields.length > 0);
  return open.find((c) => c.status === "open") ?? open.find((c) => c.status === "demo") ?? null;
}

/**
 * The criteria the self-assessment uses: the IWS 2.0 merit criteria. Read from
 * the demo call (a copy of IWS 2.0) or IWS 2.0 itself, whichever exists.
 */
export async function scoringCall(): Promise<CallInfo | null> {
  const rows = await db.select().from(calls).where(inArray(calls.id, ["demo-iws", "iws-2-0"]));
  const infos = rows.map(toCallInfo).filter((c) => c.criteria.length > 0);
  return infos.find((c) => c.id === "demo-iws") ?? infos.find((c) => c.id === "iws-2-0") ?? null;
}
