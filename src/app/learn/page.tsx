import { type Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";

import { EmptyState, PageHeader } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Materiały",
  description:
    "Raporty, narzędzia, filmy i przewodniki o innowacjach społecznych — oraz krótko: jak powstaje innowacja społeczna.",
};

/** Known kinds, in display order. Unknown kinds fall under „Inne materiały". */
const KINDS: { keys: string[]; heading: string }[] = [
  { keys: ["report", "raport", "reports"], heading: "Raporty" },
  {
    keys: ["tool", "narzedzie", "narzędzie", "canvas", "tools"],
    heading: "Narzędzia",
  },
  {
    keys: ["guide", "przewodnik", "handbook", "manual"],
    heading: "Przewodniki",
  },
  { keys: ["video", "film", "videos", "webinar"], heading: "Filmy" },
  {
    keys: ["course", "kurs", "training", "szkolenie"],
    heading: "Kursy i szkolenia",
  },
  {
    keys: ["article", "artykul", "artykuł", "publication", "publikacja"],
    heading: "Publikacje",
  },
];

function headingFor(kind: string | null | undefined) {
  const k = (kind ?? "").trim().toLowerCase();
  return KINDS.find((g) => g.keys.includes(k))?.heading ?? "Inne materiały";
}

const STEPS: { name: string; text: string }[] = [
  {
    name: "Diagnoza",
    text: "Sprawdzasz, z jakim problemem mierzą się ludzie i dlaczego dotychczasowe wsparcie nie wystarcza. Rozmawiasz z osobami, których to dotyczy.",
  },
  {
    name: "Pomysł",
    text: "Szukasz nowego sposobu rozwiązania problemu — razem z odbiorcami. Sprawdzasz, czy podobne rozwiązanie już gdzieś działa.",
  },
  {
    name: "Prototyp",
    text: "Przygotowujesz prostą, pierwszą wersję usługi lub narzędzia, którą da się pokazać i wypróbować.",
  },
  {
    name: "Test",
    text: "Prototyp sprawdzają prawdziwi użytkownicy. Zbierasz opinie, poprawiasz i opisujesz, co działa, a co nie.",
  },
  {
    name: "Upowszechnienie",
    text: "Sprawdzone rozwiązanie trafia do innych gmin i organizacji — z opisem, materiałami i wsparciem we wdrożeniu.",
  },
];

export default async function LearnPage() {
  const { items } = await api.knowledge.learn();

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const h = headingFor(item.kind);
    groups.set(h, [...(groups.get(h) ?? []), item]);
  }
  const ordered = [...KINDS.map((k) => k.heading), "Inne materiały"].filter(
    (h) => groups.has(h),
  );

  return (
    <>
      <PageHeader
        eyebrow="Zasobnik wiedzy"
        title="Materiały"
        lead={
          <p>
            Raporty, narzędzia i filmy o innowacjach społecznych — dla
            mieszkańców, organizacji i gmin. Każdy materiał otwiera się na
            stronie wydawcy.
          </p>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {ordered.length > 0 ? (
          <div className="space-y-14">
            {ordered.map((heading, gi) => (
              <section key={heading} aria-labelledby={`kind-${gi}`}>
                <h2
                  id={`kind-${gi}`}
                  className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
                >
                  {heading}
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.get(heading)!.map((item) => (
                    <li key={item.url}>
                      <article className="group border-hairline hover:border-input focus-within:border-input relative flex h-full flex-col rounded-lg border p-5 transition-colors">
                        {item.publisher ? (
                          <p className="text-muted-foreground mb-2 text-sm font-bold tracking-wide">
                            {item.publisher}
                          </p>
                        ) : null}
                        <h3 className="font-display text-lg leading-snug font-bold">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground decoration-primary decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-lg"
                          >
                            {item.title}
                            <span className="sr-only">
                              {" "}
                              (otwiera się w nowej karcie)
                            </span>
                          </a>
                        </h3>
                        {item.description ? (
                          <p className="text-foreground/85 mt-2 line-clamp-4 text-base leading-snug">
                            {item.description}
                          </p>
                        ) : null}
                        <div aria-hidden="true" className="min-h-5 flex-1" />
                        <p
                          aria-hidden="true"
                          className="border-hairline text-muted-foreground flex items-center gap-1.5 border-t pt-3 text-sm font-semibold"
                        >
                          <ExternalLinkIcon className="size-4" />
                          Strona wydawcy · nowa karta
                        </p>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpenIcon />}
            title="Materiały są w przygotowaniu"
            description={
              <p>
                Wkrótce znajdziesz tu raporty, narzędzia i filmy. Tymczasem
                zajrzyj do Biblioteki Innowacji Społecznych.
              </p>
            }
            action={
              <Button asChild>
                <Link href="/library">Przejdź do Biblioteki</Link>
              </Button>
            }
          />
        )}

        <section
          aria-labelledby="how-heading"
          className="border-hairline mt-16 border-t pt-10"
        >
          <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
            <div>
              <h2
                id="how-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
              >
                Jak powstaje innowacja społeczna
              </h2>
              <p className="text-foreground/85 mt-3">
                Pięć kroków — od problemu do rozwiązania, które działa w wielu
                miejscach.
              </p>
            </div>
            <ol className="max-w-[68ch] space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.name} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="font-display text-primary tabular w-8 shrink-0 text-2xl leading-none font-bold"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold">
                      <span className="sr-only">Krok {i + 1}: </span>
                      {s.name}
                    </h3>
                    <p className="mt-1">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}
