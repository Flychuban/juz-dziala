import { index } from "drizzle-orm/pg-core";

import type { CallStatus, MapaArea } from "~/lib/domain";
import { createTable } from "./_table";

/** Organisations — from library „Autorzy" (real) or sample (labelled). */
export const orgs = createTable("org", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  type: d.text().notNull(),
  gminaTeryt: d.text(),
  innovationIds: d.text().array().notNull().default([]),
  sourceUrl: d.text(),
  isSample: d.boolean().notNull().default(false),
}));

/** Where an innovation is tested/implemented („Działa już w"). */
export const innovationSites = createTable(
  "innovation_site",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    innovationId: d.text().notNull(),
    orgId: d.text(),
    place: d.text().notNull(),
    gminaTeryt: d.text(),
    powiatTeryt: d.text(),
    stage: d.text().notNull().default("test"),
    /** The card sentence that states it, when real. */
    sentenceId: d.text(),
    sourceUrl: d.text(),
    isSample: d.boolean().notNull().default(false),
  }),
  (t) => [index("site_innovation_idx").on(t.innovationId)],
);

/** Mentors and experts. All fictional and flagged isSample in the prototype. */
export const people = createTable("person", (d) => ({
  id: d.text().primaryKey(),
  displayName: d.text().notNull(),
  role: d.text().$type<"mentor" | "expert" | "rops">().notNull(),
  title: d.text(),
  areas: d.text().array().$type<MapaArea[]>().notNull().default([]),
  orgName: d.text(),
  bio: d.text(),
  isSample: d.boolean().notNull().default(true),
}));

export type FormField = { key: string; label: string; hint?: string | null };
export type Criterion = {
  key: string;
  label: string;
  max: number;
  description?: string | null;
};

/** Grant calls („nabory"). Publishing or changing one notifies subscribers. */
export type CallEn = {
  name: string;
  program?: string | null;
  operator?: string | null;
  eligibility: string[];
  formFields: FormField[];
  criteria: Criterion[];
  notes?: string | null;
};

export const calls = createTable("call", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  program: d.text(),
  operator: d.text(),
  amountMax: d.integer(),
  amountAvg: d.integer(),
  windowFrom: d.date({ mode: "string" }),
  windowTo: d.date({ mode: "string" }),
  status: d.text().$type<CallStatus>().notNull(),
  eligibility: d.text().array().notNull().default([]),
  formFields: d.jsonb().$type<FormField[]>().notNull().default([]),
  criteria: d.jsonb().$type<Criterion[]>().notNull().default([]),
  minScore: d.integer(),
  areas: d.text().array().$type<MapaArea[]>().notNull().default([]),
  sourceUrl: d.text(),
  notes: d.text(),
  /** English version of the call's prose (data/calls.en.json → seed). */
  en: d.jsonb().$type<CallEn>(),
  updatedAt: d
    .timestamp({ withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
}));
