import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CaseWorkspace } from "~/components/cases/staff/case-workspace";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { api, HydrateClient } from "~/trpc/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("admin.workspace");
  const code = normalizeCaseCode(decodeURIComponent((await params).code));
  return { title: code ? `${t("metaTitle")} ${code}` : t("metaTitle") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const typed = decodeURIComponent((await params).code);
  const code = normalizeCaseCode(typed);
  if (!code) redirect(`/admin/cases?q=${encodeURIComponent(typed)}`);
  if (code !== typed) redirect(`/admin/cases/${code}`);
  await api.admin.inbox.get.prefetch({ code });
  return (
    <HydrateClient>
      <CaseWorkspace code={code} basePath="/admin/cases" />
    </HydrateClient>
  );
}
