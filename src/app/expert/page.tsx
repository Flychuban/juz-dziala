import { Suspense } from "react";

import { CaseWorkspace } from "~/components/cases/staff/case-workspace";
import { InboxList } from "~/components/cases/staff/inbox-list";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = { title: "Moje sprawy" };

/** An expert's cases: the list, or one case with ?code=JD-…. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? normalizeCaseCode(sp.code) : null;
  if (code) {
    await api.admin.inbox.get.prefetch({ code });
    return (
      <HydrateClient>
        <CaseWorkspace code={code} basePath="/expert" />
      </HydrateClient>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold">Moje sprawy</h1>
      <p className="mt-2 max-w-prose">
        Sprawy, które Zespół Hubu przydzielił Tobie. O nowych dowiesz się z
        dzwonka „Powiadomienia”.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p role="status">Wczytuję sprawy…</p>}>
          <InboxList basePath="/expert" />
        </Suspense>
      </div>
    </div>
  );
}
