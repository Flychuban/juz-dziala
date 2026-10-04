import { asc, eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

import {
  MAPA_AREA_LABEL,
  MAPA_AREA_LABEL_EN,
  mapaAreaSchema,
  SITE,
} from "~/lib/domain";
import { db } from "~/server/db";
import { innovations } from "~/server/db/schema";
import { localizeCard } from "~/server/library/english";

export const dynamic = "force-dynamic";

const LIBRARY_URL =
  "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

/**
 * Open JSON API: every published card of the Biblioteka Innowacji Społecznych.
 * Optional `?area=<MapaArea>` filter. CORS-open, cacheable for 5 minutes.
 * The licence differs per card (CC BY 4.0 or a ROPS licence agreement), so
 * it is given on every record together with the card's own source URL.
 * Each record carries `en`: the AI translation of the card, or null when there
 * is none or the Polish card changed after it was translated. The response
 * does not depend on the visitor's language cookie, so it stays cacheable.
 */
export async function GET(req: NextRequest) {
  const areaParam = req.nextUrl.searchParams.get("area");
  const area = areaParam ? mapaAreaSchema.safeParse(areaParam) : null;
  if (area && !area.success) {
    return Response.json(
      {
        error:
          "Nieznany obszar / Unknown area. Dozwolone / allowed: " +
          mapaAreaSchema.options.join(", "),
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const rows = await db
    .select()
    .from(innovations)
    .where(eq(innovations.status, "published"))
    .orderBy(asc(innovations.id));

  const origin = req.nextUrl.origin;
  const data = rows
    .filter((r) => !area?.success || r.mapaAreas.includes(area.data))
    .map((r) => {
      const en = localizeCard(r, "en");
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        url: `${origin}/library/${r.slug}`,
        categories: r.categories,
        categoryLabels: r.categoryLabels,
        mapaAreas: r.mapaAreas,
        mapaAreaLabels: r.mapaAreas.map((a) => MAPA_AREA_LABEL[a]),
        sections: r.sections,
        badge: r.badge,
        videoUrl: r.videoUrl,
        folderUrl: r.folderUrl,
        materialsUrl: r.materialsUrl,
        licence: r.licence,
        licenceUrl: r.licenceUrl,
        sourceUrl: r.sourceUrl,
        capturedAt: r.capturedAt.toISOString(),
        sha256: r.sha256,
        en:
          en.lang === "en"
            ? {
                title: en.title,
                categoryLabels: en.categoryLabels,
                mapaAreaLabels: r.mapaAreas.map((a) => MAPA_AREA_LABEL_EN[a]),
                sections: en.sections,
                keywords: en.keywords,
                badge: en.badge,
                translatedBy:
                  "AI (Claude), from the Polish card; the Polish text is authoritative",
                translatedAt: r.en?.translatedAt ?? null,
              }
            : null,
      };
    });

  return Response.json(
    {
      source: {
        name: "Biblioteka Innowacji Społecznych",
        publisher: SITE.owner,
        url: LIBRARY_URL,
      },
      licence:
        "Licencja jest podana przy każdym rekordzie (pole licence / licenceUrl) — zgodnie z kartą w Bibliotece ROPS.",
      attribution: `Źródło: Biblioteka Innowacji Społecznych, ${SITE.owner} (${LIBRARY_URL}). Udostępnione przez serwis „${SITE.name}” — ${SITE.hub}.`,
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
