import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CaseLookup } from "~/components/cases/case-lookup";
import { CaseView } from "~/components/cases/case-view";
import { caseForPage } from "~/server/cases/access";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { api, HydrateClient } from "~/trpc/server";

type Params = Promise<{ code: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const t = await getTranslations("cases.meta");
  const code = normalizeCaseCode(decodeURIComponent((await params).code));
  return { title: code ? t("case", { code }) : t("lookup") };
}

function Lookup({
  title,
  typed,
  error,
}: {
  title: string;
  typed: string;
  error: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="mt-8">
        <CaseLookup initialValue={typed} initialError={error} />
      </div>
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("cases"),
  ]);
  const typed = decodeURIComponent(raw);
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const code = normalizeCaseCode(typed);

  if (!code) {
    return (
      <Lookup
        title={t("lookup.title")}
        typed={typed}
        error={t("errors.badCode")}
      />
    );
  }
  if (code !== typed) {
    redirect(`/case/${code}${token ? `?t=${encodeURIComponent(token)}` : ""}`);
  }
  // A wrong code is answered here, once (and counted once) — the client
  // would otherwise ask again.
  const found = await caseForPage(code);
  if (!found.ok) {
    return <Lookup title={t("lookup.title")} typed={code} error={found.message} />;
  }
  // Server-render the case so it shows at once (and without JavaScript).
  await api.cases.get.prefetch({ code, token });
  return (
    <HydrateClient>
      <CaseView code={code} token={token} />
    </HydrateClient>
  );
}
