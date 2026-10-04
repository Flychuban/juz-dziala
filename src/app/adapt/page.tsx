import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdaptWizard } from "~/components/adapt/adapt-wizard";
import { PageHeader, SourceLine } from "~/components/kit";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adapt.page");
  return { title: t("title"), description: t("description") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function AdaptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("adapt.page");
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
        breadcrumbs={[{ label: t("breadcrumb"), href: "/library" }]}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={<p>{t("lead")}</p>}
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
            source={t("sourceLibrary")}
            href="https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych"
          />
          <SourceLine
            source={t("sourceGus")}
            href="https://bdl.stat.gov.pl/bdl/start"
          />
        </div>
      </div>
    </>
  );
}
