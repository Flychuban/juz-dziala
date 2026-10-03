import { PagePlaceholder } from "~/components/layout/page-placeholder";

export const metadata = { title: "Moja sprawa" };

export default function Page() {
  return (
    <PagePlaceholder
      module="V · Komunikacja"
      title="Moja sprawa"
      lead="Wpisz kod sprawy, aby zobaczyć odpowiedź."
    />
  );
}
