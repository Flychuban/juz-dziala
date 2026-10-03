import Link from "next/link";

import { PageHeader } from "~/components/kit";

export const metadata = { title: "Informacja w polskim języku migowym" };

/** Required by the ustawa o zapewnianiu dostępności (art. 6 pkt 3 lit. c). Recording to be made by a PJM interpreter. */
export default function SignLanguagePage() {
  return (
    <>
      <PageHeader
        width="narrow"
        eyebrow="Dostępność"
        title="Informacja w polskim języku migowym (PJM)"
        lead="Tu będzie nagranie, w którym tłumacz PJM opowiada, czym jest serwis Już Działa i jak z niego korzystać."
      />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-lg">
        <div
          role="img"
          aria-label="Miejsce na nagranie w polskim języku migowym — w przygotowaniu"
          className="border-input bg-surface text-muted-foreground flex aspect-video items-center justify-center rounded-md border-2 border-dashed p-6 text-center"
        >
          Nagranie w PJM — przygotuje je tłumacz polskiego języka migowego przed
          uruchomieniem serwisu.
        </div>
        <p>
          Do czasu publikacji nagrania możesz skorzystać z{" "}
          <Link href="/easy-read">informacji w tekście łatwym do czytania</Link>{" "}
          albo napisać do nas przez formularz{" "}
          <Link href="/network">Zapytaj eksperta</Link>.
        </p>
      </div>
    </>
  );
}
