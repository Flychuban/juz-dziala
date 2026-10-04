import { useTranslations } from "next-intl";

import { PageHeader, type Crumb } from "~/components/kit";

/** Page header for the staff panel: „Panel Hubu" eyebrow and breadcrumbs. */
export function AdminHeader({
  title,
  lead,
  breadcrumbs,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  breadcrumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.header");
  return (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={title}
      lead={lead}
      breadcrumbs={[
        { label: t("dashboard"), href: "/admin" },
        ...(breadcrumbs ?? []),
      ]}
    >
      {children}
    </PageHeader>
  );
}
