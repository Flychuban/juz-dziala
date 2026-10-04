import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { InboxList } from "~/components/cases/staff/inbox-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.inbox");
  return { title: t("metaTitle") };
}

export default async function Page() {
  const t = await getTranslations("admin.inbox");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 max-w-prose">{t("lead")}</p>
      <div className="mt-6">
        <Suspense fallback={<p role="status">{t("loading")}</p>}>
          <InboxList basePath="/admin/cases" />
        </Suspense>
      </div>
    </div>
  );
}
