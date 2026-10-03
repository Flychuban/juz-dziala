import { type Metadata } from "next";

import { AdminHeader } from "~/components/admin/admin-header";
import { DocumentDraft } from "~/components/admin/document-draft";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Dodaj kartę z dokumentu" };

export default async function NewInnovationPage() {
  const categories = await api.admin.library.categories();
  return (
    <>
      <AdminHeader
        title="Dodaj kartę z dokumentu"
        breadcrumbs={[{ label: "Biblioteka — edycja", href: "/admin/library" }]}
        lead={
          <p>
            Wgraj folder PDF, wklej opis albo podaj adres strony. Asystent AI
            przygotuje sześć sekcji karty i przy każdej pokaże cytat z
            dokumentu. Ty sprawdzasz i zapisujesz — nic nie trafia do Biblioteki
            bez Twojej decyzji.
          </p>
        }
      />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <DocumentDraft categories={categories} />
      </div>
    </>
  );
}
