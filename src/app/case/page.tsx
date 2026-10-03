import { CaseLookup, MyCases } from "~/components/cases/case-lookup";

export const metadata = { title: "Moja sprawa" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold sm:text-4xl">Moja sprawa</h1>
      <p className="mt-3 max-w-prose text-lg">
        Wpisz kod sprawy, aby zobaczyć odpowiedź Zespołu Hubu i dopisać
        wiadomość. Nie potrzebujesz konta.
      </p>
      <div className="mt-8">
        <CaseLookup />
      </div>
      <MyCases />
    </div>
  );
}
