import { type Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";

import { countPl, PageHeader, SourceLine } from "~/components/kit";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Kondycja Małopolski",
  description:
    "Osiem obszarów Mapy Wyzwań Społecznych: definicje, kluczowe wyzwania, liczby i sprawdzone rozwiązania.",
};

export default async function KnowledgePage() {
  const data = await api.knowledge.areas();

  return (
    <>
      <PageHeader
        eyebrow="Mapa Wyzwań Społecznych"
        title="Kondycja Małopolski"
        lead={
          <p>
            Osiem obszarów, w których mieszkańcy regionu najczęściej potrzebują
            wsparcia. Przy każdym znajdziesz kluczowe wyzwania, liczby ze
            źródłem i rozwiązania z Biblioteki, które już działają.
          </p>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {!data.available ? (
          <p
            role="note"
            className="border-input bg-surface mb-8 max-w-[68ch] rounded-md border border-dashed px-4 py-3"
          >
            Opisy obszarów z Mapy Wyzwań Społecznych są w przygotowaniu. Liczby
            rozwiązań pochodzą z Biblioteki Innowacji Społecznych.
          </p>
        ) : null}

        <h2 className="sr-only">Obszary</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.areas.map((a, i) => (
            <li key={a.key}>
              <article className="group border-hairline hover:border-input focus-within:border-input relative flex h-full flex-col rounded-lg border p-5 transition-colors">
                <p
                  aria-hidden="true"
                  className="text-muted-foreground tabular text-sm font-bold"
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="font-display mt-1 text-xl leading-snug font-bold tracking-tight">
                  <Link
                    href={`/knowledge/${a.key}`}
                    className="text-foreground decoration-primary decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-lg"
                  >
                    {a.label}
                  </Link>
                </h3>
                {a.firstChallenge ? (
                  <p className="text-foreground/85 mt-3 line-clamp-4 text-base leading-snug">
                    <span className="sr-only">Kluczowe wyzwanie: </span>
                    {a.firstChallenge}
                  </p>
                ) : null}
                <div aria-hidden="true" className="min-h-5 flex-1" />
                <p className="border-hairline text-foreground flex items-center justify-between gap-2 border-t pt-3 text-[0.9375rem] font-semibold">
                  <span className="tabular">
                    {countPl(
                      a.innovationCount,
                      "rozwiązanie",
                      "rozwiązania",
                      "rozwiązań",
                    )}
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="text-primary size-5 transition-transform group-hover:translate-x-0.5"
                  />
                </p>
              </article>
            </li>
          ))}
        </ul>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            {data.source ? (
              <SourceLine
                source={data.source.name}
                href={data.source.url}
                date={data.source.date}
              />
            ) : null}
            <SourceLine
              className="mt-1"
              label="Liczby rozwiązań"
              source="Biblioteka Innowacji Społecznych, ROPS w Krakowie"
              href="/library"
            />
          </div>
          <Link
            href="/learn"
            className="group border-hairline hover:border-input flex items-center gap-4 rounded-lg border p-5 no-underline"
          >
            <BookOpenIcon
              aria-hidden="true"
              className="text-primary size-8 shrink-0 stroke-[1.5]"
            />
            <span className="min-w-0">
              <span className="font-display block text-lg font-bold group-hover:underline">
                Materiały i raporty
              </span>
              <span className="text-foreground/85 block text-base">
                Raporty, narzędzia i filmy o innowacjach społecznych.
              </span>
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
