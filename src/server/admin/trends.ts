import "server-only";

import { and, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";

import { powiatKey } from "~/components/map/powiaty";
import { type Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { MAPA_AREA_LABEL, type MapaArea } from "~/lib/domain";
import { aiStructured, userData } from "~/server/ai/structured";
import {
  ADMIN_CALL_TOPIC_SYSTEM,
  adminCallTopicUser,
} from "~/server/ai/prompts/admin-call-topic";
import { type Db } from "~/server/db";
import { cases, innovations, matchRuns } from "~/server/db/schema";
import { looksLikeGibberish } from "./gibberish";
import { isArea, isUnmet, powiatName, type Need } from "./needs";

export * from "./needs";
export { looksLikeGibberish } from "./gibberish";

/**
 * Needs of the last `days` days: matching runs plus „need" cases that did not
 * come from a run. Test inputs and keyboard noise (looksLikeGibberish) are
 * left out, so they never count as a trend or a „biała plama".
 */
export async function loadNeeds(
  db: Db,
  opts: { days: number; area?: MapaArea | null },
): Promise<Need[]> {
  const since = new Date(Date.now() - opts.days * 86_400_000);
  const [runs, needCases] = await Promise.all([
    db.select().from(matchRuns).where(gte(matchRuns.createdAt, since)),
    db
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.kind, "need"),
          isNull(cases.matchRunId),
          gte(cases.createdAt, since),
        ),
      ),
  ]);
  const needs: Need[] = [
    ...runs.map((r) => ({
      source: "run" as const,
      at: r.createdAt,
      areas: r.areas.filter(isArea),
      powiat: r.powiatTeryt
        ? powiatKey(r.powiatTeryt)
        : r.gminaTeryt
          ? powiatKey(r.gminaTeryt)
          : null,
      text: r.queryRedacted,
      unmet: isUnmet(r),
      isSample: r.isSample,
    })),
    ...needCases.map((c) => ({
      source: "case" as const,
      at: c.createdAt,
      areas: c.areas.filter(isArea),
      powiat: c.powiatTeryt
        ? powiatKey(c.powiatTeryt)
        : c.gminaTeryt
          ? powiatKey(c.gminaTeryt)
          : null,
      text: c.bodyRedacted,
      unmet: false,
      isSample: c.isSample,
    })),
  ].filter((n) => !looksLikeGibberish(n.text));
  return opts.area ? needs.filter((n) => n.areas.includes(opts.area!)) : needs;
}

/** „Zaproponuj temat naboru" — a draft call topic for ROPS staff. */
export const callTopicSchema = z.object({
  title: z.string(),
  problem: z.string(),
  targetGroup: z.string(),
  whyNoExistingFits: z.string(),
  expectedChange: z.string(),
  questionsForRops: z.array(z.string()),
});
export type CallTopicDraft = z.infer<typeof callTopicSchema>;

export async function proposeCallTopic(
  db: Db,
  opts: {
    area: MapaArea | "none";
    powiat: string | null;
    days: number;
    /** Language of the draft and of the messages (the staff member's). */
    locale?: Locale;
  },
): Promise<
  | { ok: true; draft: CallTopicDraft; basedOn: number }
  | { ok: false; message: string }
> {
  const needs = (await loadNeeds(db, { days: opts.days })).filter(
    (n) =>
      n.unmet &&
      (opts.area === "none"
        ? n.areas.length === 0
        : n.areas.includes(opts.area)) &&
      (opts.powiat ? n.powiat === opts.powiat : true),
  );
  const t = translatorFor(opts.locale ?? "pl", "admin");
  if (needs.length === 0)
    return { ok: false, message: t("trends.topic.noNeeds") };

  const library =
    opts.area === "none"
      ? []
      : (
          await db
            .select({
              title: innovations.title,
              sections: innovations.sections,
              mapaAreas: innovations.mapaAreas,
            })
            .from(innovations)
            .where(eq(innovations.status, "published"))
        )
          .filter((i) => i.mapaAreas.includes(opts.area as MapaArea))
          .slice(0, 40)
          .map(
            (i) => `- ${i.title}: ${(i.sections.solution ?? "").slice(0, 220)}`,
          );

  const phrasings = [...new Set(needs.map((n) => n.text.trim()))].slice(0, 15);
  const res = await aiStructured({
    fn: "admin.proposeCallTopic",
    schema: callTopicSchema,
    system: [{ text: ADMIN_CALL_TOPIC_SYSTEM, cache: true }],
    user: adminCallTopicUser({
      area:
        opts.area === "none"
          ? "bez przypisanego obszaru"
          : MAPA_AREA_LABEL[opts.area],
      place: opts.powiat ? powiatName(opts.powiat) : "cała Małopolska",
      count: needs.length,
      days: opts.days,
      needs: userData(
        "potrzeby",
        phrasings.map((p, i) => `${i + 1}. ${p}`).join("\n"),
      ),
      library: userData(
        "biblioteka",
        library.join("\n") || "(brak kart w tym obszarze)",
      ),
    }),
    locale: opts.locale,
    effort: "medium",
  });
  if (!res.ok)
    return {
      ok: false,
      message:
        res.reason === "unavailable"
          ? t("trends.topic.aiUnavailable")
          : t("trends.topic.failed"),
    };
  return { ok: true, draft: res.data, basedOn: needs.length };
}
