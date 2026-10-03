import { type Metadata } from "next";
import Link from "next/link";
import { FlaskConicalIcon, SearchXIcon, StarIcon } from "lucide-react";

import { AreaTag, countPl, EmptyState, PageHeader, SourceLine } from "~/components/kit";
import { RateWizard, TestSignUpWizard } from "~/components/tests/tester-forms";
import { TestableCard } from "~/components/tests/testable-card";
import { Button } from "~/components/ui/button";
import { gminaOptions } from "~/server/ideas/data";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Testuj innowacje",
  description: "Zgłoś się do testowania nowych rozwiązań społecznych albo oceń te, które znasz.",
};

export const dynamic = "force-dynamic";

const LIBRARY_URL = "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

function one(v: string | string[] | undefined) {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s?.length ? s : undefined;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const slug = one(sp.innovation)?.slice(0, 200);
  const mode = one(sp.mode);

  if (slug) {
    const [inn, { gminas, powiaty }] = await Promise.all([api.tests.bySlug({ slug }), gminaOptions()]);
    if (!inn) {
      return (
        <>
          <PageHeader eyebrow="Tester innowacji" title="Testuj innowacje" breadcrumbs={[{ label: "Testuj innowacje", href: "/test" }]} />
          <div className="mx-auto max-w-4xl px-4 py-10">
            <EmptyState
              icon={<SearchXIcon />}
              title="Nie znaleźliśmy tego rozwiązania"
              description={<p>Może adres jest niepełny. Wybierz rozwiązanie z listy.</p>}
              action={
                <Button asChild>
                  <Link href="/test">Zobacz listę rozwiązań</Link>
                </Button>
              }
            />
          </div>
        </>
      );
    }
    const back = `/test?innovation=${encodeURIComponent(inn.slug)}`;
    return (
      <>
        <PageHeader
          eyebrow="Tester innowacji"
          title={mode === "signup" ? "Chcę testować" : mode === "rate" ? "Oceń rozwiązanie" : inn.title}
          lead={
            mode === "signup" || mode === "rate" ? (
              <p>„{inn.title}”</p>
            ) : (
              <p>{inn.summary}</p>
            )
          }
          breadcrumbs={[{ label: "Testuj innowacje", href: "/test" }]}
          width="narrow"
        >
          <div className="mt-4 flex flex-wrap gap-2">
            {inn.areas.map((a) => (
              <AreaTag key={a} area={a} />
            ))}
          </div>
          <SourceLine className="mt-4" source="Biblioteka Innowacji Społecznych ROPS Kraków" href={inn.sourceUrl} date={inn.capturedAt} />
        </PageHeader>
        <div className="mx-auto max-w-4xl px-4 py-10 md:py-12">
          {mode === "signup" ? (
            <>
              {!inn.testingOpen ? (
                <p role="note" className="border-hairline bg-surface mb-8 rounded-md border border-l-4 p-4">
                  To rozwiązanie nie ma teraz otwartego naboru testerów. Zgłoś się — zespół ROPS odezwie się, gdy testy ruszą.
                </p>
              ) : null}
              <TestSignUpWizard innovation={{ id: inn.id, title: inn.title }} gminas={gminas} powiaty={powiaty} backHref={back} />
            </>
          ) : mode === "rate" ? (
            <RateWizard innovation={{ id: inn.id, title: inn.title }} backHref={back} />
          ) : (
            <section aria-labelledby="choose-h" className="flex flex-col gap-6">
              <h2 id="choose-h" className="font-display text-2xl font-bold">
                Co chcesz zrobić?
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                  href={`${back}&mode=signup`}
                  className="border-input hover:bg-surface flex min-h-24 flex-col gap-2 rounded-lg border-2 p-5"
                >
                  <span className="flex items-center gap-2 text-xl font-bold">
                    <FlaskConicalIcon aria-hidden="true" className="size-6" />
                    Chcę testować
                  </span>
                  <span>Zgłoś się — sprawdzisz rozwiązanie w praktyce i powiesz, co działa.</span>
                </Link>
                <Link href={`${back}&mode=rate`} className="border-input hover:bg-surface flex min-h-24 flex-col gap-2 rounded-lg border-2 p-5">
                  <span className="flex items-center gap-2 text-xl font-bold">
                    <StarIcon aria-hidden="true" className="size-6" />
                    Oceń rozwiązanie
                  </span>
                  <span>Znasz je? Daj ocenę od 1 do 5 i napisz, co poprawić.</span>
                </Link>
              </div>
              <p>
                <Link href={`/library/${inn.slug}`} className="text-primary font-semibold underline underline-offset-4">
                  Przeczytaj całą kartę rozwiązania w Bibliotece
                </Link>
              </p>
            </section>
          )}
        </div>
      </>
    );
  }

  const list = await api.tests.list();
  return (
    <>
      <PageHeader
        eyebrow="Tester innowacji"
        title="Testuj innowacje"
        lead={
          <p>
            Nowe rozwiązania społeczne trzeba sprawdzić w prawdziwym życiu. Zgłoś się do testów albo oceń rozwiązanie, które już znasz — Twoja opinia trafi do
            zespołu ROPS i autorów.
          </p>
        }
      />
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <section aria-labelledby="list-h">
          <h2 id="list-h" className="font-display text-2xl font-bold">
            {list.mode === "open" ? "Rozwiązania, które szukają testerów" : "Kandydaci do testów"}
          </h2>
          {list.mode === "candidates" ? (
            <p role="note" className="border-hairline bg-surface mt-4 max-w-prose rounded-md border border-l-4 p-4">
              Teraz żadne rozwiązanie nie ma otwartego naboru testerów. Poniżej są rozwiązania, które ROPS wybrał do upowszechniania — możesz zgłosić chęć
              testowania albo je ocenić. Zespół ROPS odezwie się, gdy testy ruszą.
            </p>
          ) : null}
          <p className="text-muted-foreground mt-4">
            {countPl(list.items.length, "rozwiązanie", "rozwiązania", "rozwiązań")}
          </p>
          {list.items.length ? (
            <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((i) => (
                <li key={i.id}>
                  <TestableCard item={i} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-6"
              icon={<FlaskConicalIcon />}
              title="Brak rozwiązań do testowania"
              description={<p>Zajrzyj do Biblioteki — każde rozwiązanie możesz ocenić z jego karty.</p>}
              action={
                <Button asChild>
                  <Link href="/library">Przejdź do Biblioteki</Link>
                </Button>
              }
            />
          )}
          <SourceLine className="mt-8" source="Biblioteka Innowacji Społecznych ROPS Kraków" href={LIBRARY_URL} />
        </section>
      </div>
    </>
  );
}
