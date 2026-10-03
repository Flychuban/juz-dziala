import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { countPl } from "~/components/kit";
import { MalopolskaOutline, powiatCount } from "~/components/match/malopolska-outline";
import { ProblemForm } from "~/components/match/problem-form";
import { SITE } from "~/lib/domain";
import { gminas } from "~/server/match/data-files";
import { getLibrary } from "~/server/match/library";

export const dynamic = "force-dynamic";

const DOORS = [
  { href: "/ideas/new", label: "Mam pomysł", hint: "Zgłoś pomysł na innowację społeczną" },
  { href: "/municipality", label: "Szukam rozwiązań dla gminy", hint: "Dla urzędów, OPS i organizacji" },
  { href: "/test", label: "Chcę testować", hint: "Wypróbuj nowe rozwiązania i oceń je" },
  { href: "/case", label: "Mam kod sprawy", hint: "Sprawdź odpowiedź ROPS" },
] as const;

export default async function HomePage() {
  let cards: number | null = null;
  try {
    cards = (await getLibrary()).cards.length;
  } catch (e) {
    console.error("[home] library unavailable", e);
  }
  const options = gminas().map((g) => ({ teryt: g.teryt, name: g.name, kind: g.kind, powiatName: g.powiatName }));
  const powiaty = await powiatCount();
  const figures = [
    cards !== null ? countPl(cards, "innowacja", "innowacje", "innowacji") : null,
    powiaty !== null ? countPl(powiaty, "powiat", "powiaty", "powiatów") : null,
    options.length > 0 ? countPl(options.length, "gmina", "gminy", "gmin") : null,
  ].filter((f): f is string => f !== null);

  return (
    <>
      <section aria-labelledby="home-title" className="border-hairline bg-surface border-b [overflow-wrap:anywhere]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-10 md:pt-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14">
          <div className="min-w-0">
            <h1
              id="home-title"
              className="font-display text-[2.375rem] leading-[1.05] font-bold tracking-tight max-[22rem]:text-[1.75rem] sm:text-[3.25rem]"
            >
              Z czym przychodzisz?
            </h1>
            <p className="text-foreground/85 mt-4 max-w-[48ch] text-xl leading-relaxed">{SITE.tagline}</p>
            {figures.length > 0 && <p className="text-foreground mt-4 font-semibold lg:hidden">{figures.join(" · ")}</p>}
            <div className="border-hairline bg-background mt-7 rounded-lg border p-5 max-[22rem]:border-0 max-[22rem]:bg-transparent max-[22rem]:p-0 sm:p-7">
              <ProblemForm gminas={options} />
            </div>
          </div>
          <figure className="hidden lg:mt-24 lg:block">
            <MalopolskaOutline className="h-auto w-full" />
            {figures.length > 0 && (
              <figcaption className="border-hairline mt-5 flex flex-col gap-1 border-t pt-4">
                <span className="sr-only">Małopolska: </span>
                {figures.map((f) => (
                  <span key={f} className="font-display text-foreground text-xl font-bold">
                    {f}
                  </span>
                ))}
              </figcaption>
            )}
          </figure>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 [overflow-wrap:anywhere]">
        <p className="text-muted-foreground mt-6 max-w-3xl">
          {cards !== null ? `${cards} sprawdzonych innowacji z Biblioteki ROPS` : "Sprawdzone innowacje z Biblioteki ROPS"} · każda
          odpowiedź z cytatem ze źródła ·{" "}
          <Link href="/methodology" className="text-foreground underline underline-offset-4">
            jak działa dopasowanie
          </Link>
        </p>

        <nav aria-labelledby="doors-heading" className="mt-14 mb-4">
          <h2 id="doors-heading" className="text-2xl font-bold">
            Przychodzisz z czymś innym?
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {DOORS.map((d) => (
              <li key={d.href}>
                <Link
                  href={d.href}
                  className="group border-hairline hover:border-primary hover:bg-surface flex min-h-20 items-center justify-between gap-4 rounded-lg border px-5 py-4 no-underline max-[22rem]:px-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-foreground text-xl font-bold">{d.label}</span>
                    <span className="text-muted-foreground">{d.hint}</span>
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="text-primary size-6 shrink-0 transition-transform group-hover:translate-x-1 max-[22rem]:hidden"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
