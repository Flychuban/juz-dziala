import { type Metadata } from "next";

import { AdaptWizard } from "~/components/adapt/adapt-wizard";
import { PageHeader, SourceLine } from "~/components/kit";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Zaplanuj usługę",
  description:
    "Middleman Innowacji: projekt Ramowego Planu Wdrożenia innowacji z Biblioteki ROPS dla Twojej instytucji i gminy — z danymi GUS i aktualnymi naborami.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function AdaptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { innovations, gminas } = await api.adapt.options();
  const wanted = first(sp.innovation)?.trim();
  const preselected =
    innovations.find((i) => i.slug === wanted || i.id === wanted) ?? null;
  const gmina = first(sp.gmina)?.trim();
  const preGmina = gminas.find((g) => g.teryt === gmina) ?? null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Biblioteka Innowacji Społecznych", href: "/library" },
        ]}
        eyebrow="Middleman Innowacji · dla OPS, CUS, PCPR i organizacji"
        title="Zaplanuj usługę"
        lead={
          <p>
            Wybierz innowację z Biblioteki ROPS i odpowiedz na cztery pytania o
            swoją instytucję. Przygotujemy projekt Ramowego Planu Wdrożenia — z
            danymi GUS o Twojej gminie i z naborami, które mogą go sfinansować.
          </p>
        }
      />
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-12">
        <AdaptWizard
          innovations={innovations}
          gminas={gminas}
          initialInnovationId={preselected?.id ?? null}
          initialGminaTeryt={preGmina?.teryt ?? null}
        />
        <div className="border-hairline mt-12 space-y-1 border-t pt-6" data-no-print>
          <SourceLine
            source="Biblioteka Innowacji Społecznych, ROPS w Krakowie"
            href="https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych"
          />
          <SourceLine
            source="GUS, Bank Danych Lokalnych — ludność gmin"
            href="https://bdl.stat.gov.pl/bdl/start"
          />
        </div>
      </div>
    </>
  );
}
