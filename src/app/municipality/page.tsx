import { type Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, TrendingDownIcon } from "lucide-react";

import { countPl, PageHeader, SourceLine } from "~/components/kit";
import { formatNumberPl } from "~/components/kit/format";
import { PowiatMap } from "~/components/map";
import { GminaSearch } from "~/components/municipality/gmina-search";
import { Button } from "~/components/ui/button";
import {
  KIND_LABEL,
  pct,
  powiatDisplay,
  signedPct,
} from "~/server/adapt/profile";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Dla gminy",
  description:
    "Profil gminy w danych GUS, potrzeby zgłaszane w powiecie i rozwiązania z Biblioteki ROPS dopasowane do gminy.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MunicipalityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const powiatParam = Array.isArray(sp.powiat) ? sp.powiat[0] : sp.powiat;
  const data = await api.municipality.overview();
  const f = data.featured;

  const powiaty = new Map<string, { name: string; gminas: typeof data.gminas }>();
  for (const g of data.gminas) {
    const p = powiaty.get(g.powiatTeryt) ?? { name: g.powiatName, gminas: [] };
    p.gminas.push(g);
    powiaty.set(g.powiatTeryt, p);
  }
  const powiatList = [...powiaty.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const options = data.gminas.map((g) => ({
    teryt: g.teryt,
    name: g.name,
    label: g.label,
    powiatName: g.powiatName,
  }));
  const gusLine = (
    <SourceLine
      source={`${data.gus.name}${data.gus.year ? `, ${data.gus.year}` : ""}`}
      href={data.gus.url}
      date={data.gus.capturedAt}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="Middleman Innowacji · dla gmin i powiatów"
        title="Dla gminy"
        lead={
          <p>
            Sprawdź, jak zmienia się Twoja gmina w danych GUS, jakie potrzeby
            zgłaszają mieszkańcy powiatu i które rozwiązania z Biblioteki ROPS
            do niej pasują. Każde dopasowanie ma wypisaną regułę.
          </p>
        }
      >
        <GminaSearch options={options} />
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {f ? (
          <section aria-labelledby="featured-h" className="border-hairline rounded-lg border p-5 md:p-8">
            <p className="text-primary text-[0.9375rem] font-bold tracking-wide">
              Przykład: gmina wiejska
            </p>
            <h2 id="featured-h" className="font-display mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {f.name} — {KIND_LABEL[f.kind]}, {powiatDisplay(f.powiatName)}
            </h2>
            <p className="text-foreground/85 mt-2 max-w-[68ch]">
              Dlaczego ta gmina: wśród gmin wiejskich, w których ubywa
              mieszkańców, ma najwyższy udział osób w wieku 80+ w Małopolsce.
            </p>
            <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="border-hairline border-t-2 pt-3">
                <dt className="text-foreground text-base">Mieszkańcy</dt>
                <dd className="font-display tabular text-3xl font-bold">
                  {formatNumberPl(f.population)}
                </dd>
              </div>
              <div className="border-hairline border-t-2 pt-3">
                <dt className="text-foreground text-base">
                  Osoby w wieku 80+ (mediana gmin: {pct(f.medianShare80)}%)
                </dt>
                <dd className="font-display tabular text-3xl font-bold">
                  {pct(f.share80)}%
                </dd>
              </div>
              {f.popChange10y !== null ? (
                <div className="border-hairline border-t-2 pt-3">
                  <dt className="text-foreground text-base">
                    Zmiana liczby mieszkańców w 10 lat
                  </dt>
                  <dd className="font-display tabular flex flex-wrap items-center gap-x-2 text-3xl font-bold">
                    {f.popChange10y < 0 ? (
                      <TrendingDownIcon aria-hidden="true" className="text-brand-accent size-7" />
                    ) : null}
                    {signedPct(f.popChange10y)}
                    {f.popChange10y < 0 ? (
                      <span className="text-base font-semibold">ludność maleje</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-6">{gusLine}</div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/municipality/${f.teryt}`}>
                  Zobacz profil gminy {f.name}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/adapt?gmina=${f.teryt}`}>Zaplanuj usługę dla tej gminy</Link>
              </Button>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="map-h" className="mt-14">
          <h2 id="map-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Seniorzy 80+ w powiatach Małopolski
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            Udział osób w wieku 80 lat i więcej w ludności powiatu. Kliknij
            powiat, aby zobaczyć listę jego gmin. Mediana gmin Małopolski:{" "}
            {pct(data.medianShare80)}%.
          </p>
          <PowiatMap
            className="mt-6"
            values={data.powiatShares80}
            label={`Udział osób w wieku 80+ w ludności powiatu (%)${data.gus.year ? `, ${data.gus.year}` : ""}`}
            valueLabel="Udział 80+ (%)"
            highlight={powiatParam ? [powiatParam] : []}
            highlightLabel="wybrany"
            hrefFor={(t) => `/municipality?powiat=${t}#gminy-${t}`}
            source={gusLine}
          />
        </section>

        <section aria-labelledby="list-h" className="mt-14">
          <h2 id="list-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Gminy w powiatach
          </h2>
          <p className="text-foreground/85 mt-2">
            {formatNumberPl(data.gminas.length)} gmin w {powiatList.length} powiatach.
            Rozwiń powiat, aby wybrać gminę.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {powiatList.map(([teryt, p]) => (
              <li key={teryt} id={`gminy-${teryt}`} className="scroll-mt-6">
                <details
                  open={powiatParam === teryt}
                  className="border-hairline group rounded-md border"
                >
                  <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-semibold">
                    <span className="min-w-0">{powiatDisplay(p.name)}</span>
                    <span className="text-muted-foreground tabular shrink-0 text-sm font-normal">
                      {countPl(p.gminas.length, "gmina", "gminy", "gmin")}
                    </span>
                  </summary>
                  <div className="border-hairline overflow-x-auto border-t">
                  <table className="tabular w-full text-[0.9375rem]">
                    <caption className="sr-only">Gminy: {powiatDisplay(p.name)}</caption>
                    <thead className="bg-surface">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-semibold sm:px-4">Gmina</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Udział 80+</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-4">Zmiana w 10 lat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.gminas.map((g) => (
                        <tr key={g.teryt} className="border-hairline border-t">
                          <th scope="row" className="px-3 py-1 text-left font-normal sm:px-4">
                            <Link
                              href={`/municipality/${g.teryt}`}
                              className="inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                            >
                              {g.label}
                            </Link>
                          </th>
                          <td className="px-3 py-1 text-right sm:px-4">{pct(g.share80)}%</td>
                          <td className="px-3 py-1 text-right sm:px-4">
                            {g.popChange10y === null ? (
                              <span className="text-muted-foreground">brak porównania</span>
                            ) : (
                              signedPct(g.popChange10y)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <div className="mt-6">{gusLine}</div>
        </section>
      </div>
    </>
  );
}
