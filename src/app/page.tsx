import Link from "next/link";

import { ProblemForm } from "~/components/match/problem-form";
import { SITE } from "~/lib/domain";
import { gminas } from "~/server/match/data-files";
import { getLibrary } from "~/server/match/library";

export const dynamic = "force-dynamic";

const DOORS = [
  { href: "/ideas/new", label: "Mam pomysł", hint: "Zgłoś pomysł na innowację" },
  { href: "/municipality", label: "Szukam rozwiązań dla gminy", hint: "Dla urzędów i ośrodków" },
  { href: "/test", label: "Chcę testować", hint: "Wypróbuj nowe rozwiązania" },
  { href: "/case", label: "Mam kod sprawy", hint: "Sprawdź odpowiedź ROPS" },
] as const;

export default async function HomePage() {
  let count: number | null = null;
  try {
    count = (await getLibrary()).cards.length;
  } catch (e) {
    console.error("[home] library unavailable", e);
  }
  const options = gminas().map((g) => ({ teryt: g.teryt, name: g.name, powiatName: g.powiatName }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-bold sm:text-5xl">Z czym przychodzisz?</h1>
      <p className="mt-4 max-w-prose text-xl">{SITE.tagline}</p>

      <div className="mt-8">
        <ProblemForm gminas={options} />
      </div>

      <p className="border-hairline text-muted-foreground mt-10 border-t pt-4">
        {count !== null ? `${count} sprawdzonych innowacji z Biblioteki ROPS` : "Sprawdzone innowacje z Biblioteki ROPS"} ·
        każda odpowiedź z cytatem ze źródła ·{" "}
        <Link href="/methodology" className="text-foreground underline">
          jak działa dopasowanie
        </Link>
      </p>

      <nav aria-labelledby="doors-heading" className="mt-10">
        <h2 id="doors-heading" className="text-2xl font-bold">
          Przychodzisz z czymś innym?
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {DOORS.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className="border-hairline hover:bg-accent flex min-h-12 flex-col rounded-lg border px-4 py-3 no-underline"
              >
                <span className="text-foreground text-lg font-semibold">{d.label}</span>
                <span className="text-muted-foreground">{d.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
