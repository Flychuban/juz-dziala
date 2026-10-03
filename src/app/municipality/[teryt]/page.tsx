import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowRightIcon,
  AwardIcon,
  FileCheckIcon,
  TrendingDownIcon,
} from "lucide-react";

import {
  AreaTag,
  formatDatePl,
  PageHeader,
  SampleBadge,
  SourceLine,
  Stat,
} from "~/components/kit";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { MAPA_AREA_LABEL } from "~/lib/domain";
import {
  int,
  K_ANONYMITY,
  KIND_LABEL,
  pct,
  powiatDisplay,
  signedPct,
} from "~/server/adapt/profile";
import { api } from "~/trpc/server";

type Params = Promise<{ teryt: string }>;

const getProfile = cache((teryt: string) =>
  /^\d{7}$/.test(teryt) ? api.municipality.profile({ teryt }) : null,
);

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const data = await getProfile((await params).teryt);
  if (!data) return { title: "Nie znaleziono gminy" };
  return {
    title: `${data.profile.name} — profil gminy`,
    description: `Gmina ${data.profile.name}: ludność, seniorzy i rozwiązania z Biblioteki ROPS dopasowane do jej profilu.`,
  };
}

export default async function MunicipalityProfilePage({
  params,
}: {
  params: Params;
}) {
  const data = await getProfile((await params).teryt);
  if (!data) notFound();
  const { profile: p, gus, needs, signals, recommendations } = data;

  const gusSource = `GUS BDL, ${p.year}`;
  const where = `${KIND_LABEL[p.kind]}, ${powiatDisplay(p.powiatName)}`;
  const lead = [
    `Mieszka tu ${int(p.population)} osób; ${pct(p.share65)}% ma 65 lat lub więcej, a ${pct(p.share80)}% — 80 lat lub więcej.`,
    p.popChange10y === null
      ? null
      : p.popChange10y < 0
        ? `W latach ${gus.baseYear}–${p.year} liczba mieszkańców spadła o ${pct(Math.abs(p.popChange10y))}%.`
        : `W latach ${gus.baseYear}–${p.year} liczba mieszkańców wzrosła o ${pct(p.popChange10y)}%.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Dla gminy", href: "/municipality" }]}
        eyebrow={`Profil gminy · ${where}`}
        title={p.name}
        lead={<p>{lead}</p>}
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/adapt?gmina=${p.teryt}`}>
              Zaplanuj usługę w tej gminie
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/municipality?powiat=${p.powiatTeryt}#gminy-${p.powiatTeryt}`}>
              Inne gminy: {powiatDisplay(p.powiatName)}
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {/* ---------------------------------------------------------- profile */}
        <section aria-labelledby="profile-h">
          <h2 id="profile-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Mieszkańcy w danych GUS
          </h2>
          {p.depopulating && p.popChange10y !== null ? (
            <Alert variant="warning" role="note" className="mt-4 max-w-3xl">
              <TrendingDownIcon aria-hidden="true" />
              <AlertTitle>Ludność gminy maleje</AlertTitle>
              <AlertDescription>
                W latach {gus.baseYear}–{p.year} liczba mieszkańców zmieniła się
                o {signedPct(p.popChange10y)}. Usługi trzeba planować dla
                starszej i bardziej rozproszonej społeczności.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              value={p.population}
              label="Liczba mieszkańców (stan na 31 grudnia)"
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={p.year}
            />
            <Stat
              value={p.pop65}
              label={`Osoby w wieku 65+ — ${pct(p.share65)}% mieszkańców`}
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={p.year}
            />
            <Stat
              value={p.pop80}
              label={`Osoby w wieku 80+ — ${pct(p.share80)}% mieszkańców (mediana gmin Małopolski: ${pct(p.medianShare80)}%)`}
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={p.year}
            />
            <Stat
              value={p.popChange10y === null ? "brak" : signedPct(p.popChange10y)}
              label={
                p.popChange10y === null
                  ? `Zmiana liczby mieszkańców ${gus.baseYear}–${p.year}: brak porównania — gmina zmieniła granice`
                  : p.popChange10y < 0
                    ? `Zmiana liczby mieszkańców ${gus.baseYear}–${p.year}: ludność maleje`
                    : `Zmiana liczby mieszkańców ${gus.baseYear}–${p.year}: ludność rośnie`
              }
              source={gusSource}
              sourceHref={gus.url}
              scope={p.name}
              year={`${gus.baseYear}–${p.year}`}
            />
          </div>
          <SourceLine
            className="mt-6"
            source={`${gus.name}, ${p.year} — dane dla gminy ${p.name}`}
            href={gus.url}
            date={gus.capturedAt}
          />
        </section>

        {/* ------------------------------------------------------------ needs */}
        <section aria-labelledby="needs-h" className="border-hairline mt-14 border-t pt-10">
          <h2 id="needs-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Potrzeby zgłaszane w powiecie
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            Opisy problemów z wyszukiwarki „Już Działa” i sprawy z ostatnich{" "}
            {needs.windowDays} dni z obszaru: {powiatDisplay(p.powiatName)}.
            Liczby mniejsze niż {K_ANONYMITY} ukrywamy, żeby nikogo nie dało się
            rozpoznać.
          </p>
          <div className="border-hairline mt-6 max-w-2xl overflow-x-auto rounded-md border">
            <table className="tabular w-full border-collapse text-[0.9375rem]">
              <caption className="border-hairline border-b px-4 py-3 text-left text-base font-bold">
                Zgłoszone potrzeby według obszarów Mapy Wyzwań — {powiatDisplay(p.powiatName)}, od {formatDatePl(needs.since)}
              </caption>
              <thead className="bg-surface">
                <tr className="border-hairline border-b">
                  <th scope="col" className="px-4 py-2 text-left font-semibold">Obszar</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Zgłoszenia</th>
                </tr>
              </thead>
              <tbody>
                {needs.areas.map((a) => (
                  <tr key={a.area} className="border-hairline border-b last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {MAPA_AREA_LABEL[a.area]}
                    </th>
                    <td className="px-4 py-2 text-right">
                      {a.count === null ? (
                        <span className="text-muted-foreground">mniej niż {K_ANONYMITY}</span>
                      ) : (
                        int(a.count)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-hairline bg-surface border-t">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">Razem</th>
                  <td className="px-4 py-2 text-right font-semibold">
                    {needs.total === null ? `mniej niż ${K_ANONYMITY}` : int(needs.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {needs.includesSample ? (
            <p className="mt-3 flex items-center gap-2">
              <SampleBadge /> W zestawieniu są też zgłoszenia przykładowe.
            </p>
          ) : null}
          <SourceLine
            className="mt-4"
            source="Już Działa — anonimowe zgłoszenia mieszkańców"
            date={new Date()}
          />
        </section>

        {/* ---------------------------------------------------- recommendations */}
        <section aria-labelledby="recs-h" className="border-hairline mt-14 border-t pt-10">
          <h2 id="recs-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Rozwiązania dopasowane do profilu gminy
          </h2>
          <div className="bg-surface border-hairline mt-4 max-w-3xl rounded-md border p-5">
            <h3 className="text-lg font-bold">Dlaczego te</h3>
            <ul className="mt-2 space-y-2">
              {signals.map((s, i) => (
                <li key={`${s.id}-${i}`} className="flex gap-2">
                  <span aria-hidden="true" className="text-primary font-bold">→</span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-[0.9375rem]">
              Reguła: najpierw najlepsze rozwiązanie dla każdego powodu, potem
              te, które pasują do największej liczby powodów. Przy remisie
              wygrywają innowacje wybrane przez ROPS do upowszechniania i te z
              Ramowym Planem Wdrożenia.
            </p>
          </div>

          {recommendations.length > 0 ? (
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {recommendations.map((r) => (
                <li key={r.id}>
                  <article className="border-hairline flex h-full flex-col rounded-lg border p-5 md:p-6">
                    {r.categoryLabels.length ? (
                      <p className="text-muted-foreground mb-2 text-sm font-bold tracking-wide">
                        {r.categoryLabels.join(" · ")}
                      </p>
                    ) : null}
                    <h3 className="font-display text-xl leading-snug font-bold tracking-tight">
                      <Link
                        href={`/library/${r.slug}`}
                        className="text-foreground decoration-primary decoration-2 underline-offset-4 hover:underline"
                      >
                        {r.title}
                      </Link>
                    </h3>
                    <p className="text-foreground/85 mt-2 line-clamp-3 text-base leading-snug">
                      {r.summary}
                    </p>
                    {r.matches.length ? (
                      <div className="mt-4">
                        <p className="text-sm font-bold">Pasuje, bo:</p>
                        <ul className="mt-1 space-y-1 text-[0.9375rem]">
                          {r.matches.map((m) => (
                            <li key={m.theme}>
                              <span className="font-semibold">{m.label}</span>{" "}
                              <span className="text-foreground/85">({m.evidence})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {r.areas.map((a) => (
                        <AreaTag key={a} area={a} />
                      ))}
                    </div>
                    {r.ramowyPlan || r.badge ? (
                      <div className="border-hairline mt-4 space-y-1 border-t pt-3 text-sm font-bold">
                        {r.ramowyPlan ? (
                          <p className="flex items-center gap-2">
                            <FileCheckIcon aria-hidden="true" className="text-brand-accent size-5 shrink-0" />
                            ROPS ma Ramowy Plan Wdrożenia (Usługa Wrażliwa)
                          </p>
                        ) : null}
                        {r.badge ? (
                          <p className="text-brand-accent flex items-center gap-2">
                            <AwardIcon aria-hidden="true" className="size-5 shrink-0" />
                            Wybrana do upowszechniania
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-auto pt-5">
                      <Button asChild variant="secondary" className="w-full sm:w-auto">
                        <Link href={`/adapt?innovation=${encodeURIComponent(r.slug)}&gmina=${p.teryt}`}>
                          Zaplanuj usługę
                          <span className="sr-only">: {r.title}</span>
                          <ArrowRightIcon aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6">
              Nie znaleźliśmy pasujących rozwiązań.{" "}
              <Link href="/library" className="font-semibold underline underline-offset-4">
                Przejrzyj całą Bibliotekę
              </Link>
              .
            </p>
          )}
          <SourceLine
            className="mt-6"
            source="Biblioteka Innowacji Społecznych, ROPS w Krakowie"
            href="https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych"
            date={data.libraryCapturedAt}
          />
        </section>
      </div>
    </>
  );
}
