import { asc } from "drizzle-orm";
import { type NextRequest } from "next/server";

import {
  CALL_STATUS_LABEL,
  CALL_STATUS_LABEL_EN,
  CALL_STATUSES,
  MAPA_AREA_LABEL,
  MAPA_AREA_LABEL_EN,
  SITE,
} from "~/lib/domain";
import { db } from "~/server/db";
import { calls } from "~/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Open JSON API: grant calls („nabory") for social innovation, as published
 * by ROPS Kraków. Optional `?status=open|planned|closed|demo`. CORS-open,
 * cacheable for 5 minutes. Each record links to its own source. `en` holds
 * the English version of the call's prose (AI translation) or null; the
 * response does not depend on the visitor's language cookie.
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  if (status && !(CALL_STATUSES as readonly string[]).includes(status)) {
    return Response.json(
      {
        error: `Nieznany status / Unknown status. Dozwolone / allowed: ${CALL_STATUSES.join(", ")}`,
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const rows = await db
    .select()
    .from(calls)
    .orderBy(asc(calls.windowFrom), asc(calls.id));
  const data = rows
    .filter((c) => !status || c.status === status)
    .map((c) => ({
      id: c.id,
      name: c.name,
      program: c.program,
      operator: c.operator,
      status: c.status,
      statusLabel: CALL_STATUS_LABEL[c.status],
      isDemo: c.status === "demo",
      window: { from: c.windowFrom, to: c.windowTo },
      amountMax: c.amountMax,
      amountAvg: c.amountAvg,
      currency: "PLN",
      eligibility: c.eligibility,
      areas: c.areas,
      areaLabels: c.areas.map((a) => MAPA_AREA_LABEL[a]),
      formFields: c.formFields,
      criteria: c.criteria,
      minScore: c.minScore,
      sourceUrl: c.sourceUrl,
      notes: c.notes,
      updatedAt: c.updatedAt.toISOString(),
      en: c.en
        ? {
            ...c.en,
            statusLabel: CALL_STATUS_LABEL_EN[c.status],
            areaLabels: c.areas.map((a) => MAPA_AREA_LABEL_EN[a]),
            translatedBy:
              "AI (Claude), from the Polish text; the call documents at sourceUrl are binding",
          }
        : null,
    }));

  return Response.json(
    {
      source: { name: "Nabory na innowacje społeczne", publisher: SITE.owner },
      licence:
        "Informacje publiczne o naborach. Wiążące są dokumenty naboru pod adresem sourceUrl.",
      attribution: `Źródło: ${SITE.owner}. Udostępnione przez serwis „${SITE.name}” — ${SITE.hub}.`,
      generatedAt: new Date().toISOString(),
      count: data.length,
      data,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
