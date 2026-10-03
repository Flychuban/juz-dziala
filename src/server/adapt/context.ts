import "server-only";

import { and, arrayContains, eq } from "drizzle-orm";

import type { Db } from "~/server/db";
import { innovations, orgs } from "~/server/db/schema";
import { redactPII } from "~/server/domain/redact";
import { fundingFor, getGmina, gusSourceFor, loadGminas } from "./data";
import type { PlanInputs } from "./options";
import { buildProfile } from "./profile";
import type { PlanCard, PlanContext } from "./types";

/** One published card, as a plan needs it; null when absent. */
export async function loadPlanCard(
  db: Db,
  innovationId: string,
): Promise<PlanCard | null> {
  const card = await db.query.innovations.findFirst({
    where: and(
      eq(innovations.id, innovationId),
      eq(innovations.status, "published"),
    ),
  });
  if (!card) return null;
  const cardOrgs = await db
    .select({ name: orgs.name, isSample: orgs.isSample })
    .from(orgs)
    .where(arrayContains(orgs.innovationIds, [card.id]));
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    sections: card.sections,
    sentences: card.sentences,
    mapaAreas: card.mapaAreas,
    categoryLabels: card.categoryLabels,
    sourceUrl: card.sourceUrl,
    capturedAt: card.capturedAt.toISOString(),
    licence: card.licence,
    folderUrl: card.folderUrl,
    materialsUrl: card.materialsUrl,
    orgNames: cardOrgs.filter((o) => !o.isSample).map((o) => o.name),
  };
}

export type PlanContextResult =
  | { ok: true; ctx: PlanContext }
  | { ok: false; reason: "innovation" | "gmina" };

/**
 * Everything the plan is built from. The institution's free text is redacted
 * here, before it reaches the template, the model or the database.
 */
export async function loadPlanContext(
  db: Db,
  inputs: PlanInputs,
): Promise<PlanContextResult> {
  const [card, gmina, all] = await Promise.all([
    loadPlanCard(db, inputs.innovationId),
    getGmina(inputs.gminaTeryt),
    loadGminas(),
  ]);
  if (!card) return { ok: false, reason: "innovation" };
  if (!gmina) return { ok: false, reason: "gmina" };
  const [gus, { funding, ramowyPlan }] = await Promise.all([
    gusSourceFor(gmina),
    fundingFor(db, card.id),
  ]);
  const needs = inputs.needs?.trim()
    ? redactPII(inputs.needs.trim()).text
    : null;
  return {
    ok: true,
    ctx: {
      inputs: { ...inputs, needs },
      card,
      profile: buildProfile(gmina, all),
      gus,
      funding,
      ramowyPlan,
      generatedAt: new Date().toISOString(),
    },
  };
}
