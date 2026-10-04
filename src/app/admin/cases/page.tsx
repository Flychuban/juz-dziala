import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { InboxList } from "~/components/cases/staff/inbox-list";
import { inboxInput } from "~/components/cases/staff/labels";
import { api, HydrateClient } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.inbox");
  return { title: t("metaTitle") };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("admin.inbox");
  const input = inboxInput((k) => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  });
  // The first page of the inbox arrives with the HTML, not after a spinner.
  await api.admin.inbox.list.prefetch(input);
  return (
    <HydrateClient>
      <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 max-w-prose">{t("lead")}</p>
        <div className="mt-6">
          <Suspense fallback={<p role="status">{t("loading")}</p>}>
            <InboxList basePath="/admin/cases" />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
