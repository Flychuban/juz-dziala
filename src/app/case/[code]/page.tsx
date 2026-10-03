import { redirect } from "next/navigation";

import { CaseLookup } from "~/components/cases/case-lookup";
import { CaseView } from "~/components/cases/case-view";
import { normalizeCaseCode } from "~/server/cases/_pending-domain";

export const metadata = { title: "Moja sprawa" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp] = await Promise.all([params, searchParams]);
  const typed = decodeURIComponent(raw);
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const code = normalizeCaseCode(typed);

  if (!code) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Moja sprawa</h1>
        <div className="mt-8">
          <CaseLookup
            initialValue={typed}
            initialError="To nie wygląda na kod sprawy. Kod ma postać JD-XXXX-XXXX."
          />
        </div>
      </div>
    );
  }
  if (code !== typed) {
    redirect(`/case/${code}${token ? `?t=${encodeURIComponent(token)}` : ""}`);
  }
  return <CaseView code={code} token={token} />;
}
