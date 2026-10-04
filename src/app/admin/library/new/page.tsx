import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminHeader } from "~/components/admin/admin-header";
import { DocumentDraft } from "~/components/admin/document-draft";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.libraryNew");
  return { title: t("metaTitle") };
}

export default async function NewInnovationPage() {
  const [categories, t, tl] = await Promise.all([
    api.admin.library.categories(),
    getTranslations("admin.libraryNew"),
    getTranslations("admin.library"),
  ]);
  return (
    <>
      <AdminHeader
        title={t("title")}
        breadcrumbs={[{ label: tl("title"), href: "/admin/library" }]}
        lead={<p>{t("lead")}</p>}
      />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <DocumentDraft categories={categories} />
      </div>
    </>
  );
}
