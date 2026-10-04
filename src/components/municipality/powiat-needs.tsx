import { getLocale, getTranslations } from "next-intl/server";

import { SampleBadge, SourceLine } from "~/components/kit";
import { formatDate, formatNumber } from "~/components/kit/format";
import { labelsFor, type MapaArea } from "~/lib/domain";
import { K_ANONYMITY } from "~/server/adapt/profile";

export type PowiatNeedsData = {
  /** null = fewer than K_ANONYMITY. */
  total: number | null;
  areas: { area: MapaArea; count: number | null }[];
  includesSample: boolean;
  since: string;
  windowDays: number;
};

/**
 * The powiat's anonymised need counts by Mapa area — for ROPS and a
 * logged-in gmina only (the caller checks). Counts below K are never sent
 * by the server; fewer than K in total is one sentence, not a table of
 * „mniej niż 5".
 */
export async function PowiatNeeds({
  needs,
  powiat,
  captionId,
}: {
  needs: PowiatNeedsData;
  /** The powiat as the reader names it („powiat dąbrowski"). */
  powiat: string;
  captionId: string;
}) {
  const t = await getTranslations("municipality.needs");
  const locale = await getLocale();
  const L = labelsFor(locale);
  return (
    <>
      {needs.total === null ? (
        <p className="mt-4 max-w-2xl text-base">
          {t("tooFew", { days: needs.windowDays, k: K_ANONYMITY })}
        </p>
      ) : (
        <>
          <div
            role="region"
            aria-labelledby={captionId}
            tabIndex={0}
            className="border-hairline mt-4 max-w-2xl overflow-x-auto rounded-md border"
          >
            <table className="tabular w-full border-collapse text-[0.9375rem]">
              <caption
                id={captionId}
                className="border-hairline border-b px-4 py-3 text-left text-base font-bold"
              >
                {t("caption", { powiat, date: formatDate(needs.since, locale) })}
              </caption>
              <thead className="bg-surface">
                <tr className="border-hairline border-b">
                  <th scope="col" className="px-4 py-2 text-left font-semibold">
                    {t("colArea")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    {t("colCount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {needs.areas.map((a) => (
                  <tr key={a.area} className="border-hairline border-b last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {L.area[a.area]}
                    </th>
                    <td className="px-4 py-2 text-right">
                      {a.count === null ? (
                        <span className="text-muted-foreground">
                          {t("lessThan", { k: K_ANONYMITY })}
                        </span>
                      ) : (
                        formatNumber(a.count, locale)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-hairline bg-surface border-t">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">
                    {t("total")}
                  </th>
                  <td className="px-4 py-2 text-right font-semibold">
                    {formatNumber(needs.total, locale)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {needs.includesSample ? (
            <p className="mt-3 flex items-center gap-2">
              <SampleBadge /> {t("sample")}
            </p>
          ) : null}
        </>
      )}
      <SourceLine className="mt-4" source={t("source")} date={new Date()} />
    </>
  );
}
