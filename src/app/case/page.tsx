import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CaseLookup, MyCases } from "~/components/cases/case-lookup";
import { normalizeCaseCode } from "~/server/domain/case-code";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cases.meta");
  return { title: t("lookup") };
}

/**
 * „Moja sprawa". The lookup form also works before JavaScript loads: it is a
 * GET to /case?code=…, and a valid code redirects to its case page.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const typed = typeof sp.code === "string" ? sp.code.slice(0, 40) : "";
  const code = typed ? normalizeCaseCode(typed) : null;
  if (code) redirect(`/case/${code}`);

  const t = await getTranslations("cases.lookup");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-prose text-lg">{t("lead")}</p>
      <div className="mt-8">
        <CaseLookup
          initialValue={typed}
          initialError={
            typed ? t("invalidLoose") : sp.code !== undefined ? t("empty") : undefined
          }
        />
      </div>
      <MyCases />
    </div>
  );
}
