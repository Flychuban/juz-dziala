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
  return (
    <PageHeader
      eyebrow="Panel Hubu"
      title={title}
      lead={lead}
      breadcrumbs={[
        { label: "Pulpit", href: "/admin" },
        ...(breadcrumbs ?? []),
      ]}
    >
      {children}
    </PageHeader>
  );
}
