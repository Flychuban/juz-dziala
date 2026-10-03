import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { cache } from "react";

import {
  countPl,
  EmptyState,
  ExternalLink,
  InnovationCard,
  PageHeader,
  SourceLine,
  Stat,
} from "~/components/kit";
import { Button } from "~/components/ui/button";
import {
  MAPA_AREA_LABEL,
  MAPA_AREAS,
  mapaAreaSchema,
  type MapaArea,
} from "~/lib/domain";
import { api } from "~/trpc/server";

type Params = Promise<{ area: string }>;

const getArea = cache((key: MapaArea) => api.knowledge.area({ key }));

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const parsed = mapaAreaSchema.safeParse((await params).area);
  if (!parsed.success) return { title: "Nie znaleziono obszaru" };
  return {
    title: `${MAPA_AREA_LABEL[parsed.data]} — Kondycja Małopolski`,
  };
}

/** [12, 13, 14, 20] → „12–14, 20". */
function pageRanges(pages: (number | string)[]) {
  const nums = [
    ...new Set(pages.map((p) => Number(p)).filter(Number.isFinite)),
  ].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    const start = nums[i]!;
    let end = start;
    while (nums[i + 1] === end + 1) end = nums[++i]!;
    parts.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return parts.join(", ");
}

const SHOWN = 6;

export default async function KnowledgeAreaPage({
  params,
}: {
  params: Params;
}) {
  const parsed = mapaAreaSchema.safeParse((await params).area);
  if (!parsed.success) notFound();
  const key = parsed.data;
  const { area, source, innovations, label } = await getArea(key);

  const sourceName = source?.name ?? "Mapa Wyzwań Społecznych";
  const pages = area ? pageRanges(area.pages) : "";
  const figures = area?.figures ?? [];
  const persona = area?.persona;
  const others = MAPA_AREAS.filter((a) => a !== key);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kondycja Małopolski", href: "/knowledge" }]}
        eyebrow="Obszar Mapy Wyzwań Społecznych"
        title={area?.label ?? label}
        lead={
          area?.definition ? (
            <p>{area.definition}</p>
          ) : (
            <p>
              Opis tego obszaru z Mapy Wyzwań Społecznych jest w przygotowaniu.
            </p>
          )
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {area ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
            <section aria-labelledby="challenges-heading">
              <h2
                id="challenges-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
              >
                Kluczowe wyzwania
              </h2>
              {area.keyChallenges.length > 0 ? (
                <ol className="mt-6 max-w-[68ch] space-y-4">
                  {area.keyChallenges.map((c, i) => (
                    <li key={i} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="font-display text-primary tabular w-7 shrink-0 text-lg leading-[1.6] font-bold"
                      >
                        {i + 1}.
                      </span>
                      <span className="min-w-0">{c}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground mt-4">
                  Źródło nie wymienia kluczowych wyzwań dla tego obszaru.
                </p>
              )}
            </section>

            {persona ? (
              <section
                aria-labelledby="persona-heading"
                className="border-hairline bg-surface self-start rounded-lg border p-6"
              >
                <p className="text-muted-foreground text-sm font-bold tracking-wide">
                  Persona z Mapy Wyzwań
                </p>
                <h2
                  id="persona-heading"
                  className="font-display mt-1 text-2xl font-bold tracking-tight"
                >
                  Poznaj: {persona.name}
                  {persona.age ? `, ${persona.age}` : ""}
                </h2>
                {persona.description ? (
                  <p className="mt-3 text-base">{persona.description}</p>
                ) : null}
                {(
                  [
                    ["Czego chce", persona.goals],
                    ["Z czym się zmaga", persona.challenges],
                    ["Co ją lub go motywuje", persona.motivations],
                  ] as const
                ).map(([title, list]) =>
                  list.length > 0 ? (
                    <div
                      key={title}
                      className="border-hairline mt-5 border-t pt-4"
                    >
                      <h3 className="text-base font-bold">{title}</h3>
                      <ul className="marker:text-primary mt-2 list-disc space-y-1 pl-5 text-base">
                        {list.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
                <p className="text-muted-foreground mt-5 text-sm">
                  Persona to przykładowa postać opisana w Mapie Wyzwań — nie
                  prawdziwa osoba.
                </p>
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="Opis obszaru w przygotowaniu"
            description={
              <p>
                Wkrótce pokażemy tu definicję, kluczowe wyzwania i liczby z Mapy
                Wyzwań Społecznych. Rozwiązania z Biblioteki są dostępne już
                teraz — poniżej.
              </p>
            }
          />
        )}

        {figures.length > 0 ? (
          <section
            aria-labelledby="figures-heading"
            className="border-hairline mt-14 border-t pt-10"
          >
            <h2
              id="figures-heading"
              className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
            >
              Liczby
            </h2>
            <p className="text-foreground/85 mt-2 max-w-[68ch]">
              Przy każdej liczbie podajemy, czego dotyczy — dane dla całej
              Polski oznaczamy jako „Polska”, tak jak podaje źródło.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {figures.map((f, i) => (
                <li key={i}>
                  <Stat
                    value={f.value}
                    label={f.label}
                    scope={f.scope?.trim() ?? "Polska"}
                    year={f.year}
                    source={f.page ? `${sourceName}, s. ${f.page}` : sourceName}
                    sourceHref={source?.url}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="innovations-heading"
          className="border-hairline mt-14 border-t pt-10"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="innovations-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
              >
                Rozwiązania w tym obszarze
              </h2>
              <p className="text-foreground/85 mt-2">
                W Bibliotece:{" "}
                <span className="tabular font-semibold">
                  {countPl(
                    innovations.length,
                    "rozwiązanie",
                    "rozwiązania",
                    "rozwiązań",
                  )}
                </span>
              </p>
            </div>
            {innovations.length > SHOWN ? (
              <Button asChild variant="secondary">
                <Link href={`/library?area=${key}`}>
                  Zobacz wszystkie ({innovations.length})
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>
          {innovations.length > 0 ? (
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {innovations.slice(0, SHOWN).map((item) => (
                <li key={item.id}>
                  <InnovationCard item={item} headingLevel="h3" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-foreground/85 mt-4">
              W Bibliotece nie ma jeszcze rozwiązań w tym obszarze.{" "}
              <Link
                href="/ideas/new"
                className="font-semibold underline underline-offset-4"
              >
                Masz pomysł? Zgłoś go.
              </Link>
            </p>
          )}
        </section>

        {area && area.reports.length > 0 ? (
          <section
            aria-labelledby="reports-heading"
            className="border-hairline mt-14 border-t pt-10"
          >
            <h2
              id="reports-heading"
              className="font-display text-2xl leading-tight font-bold tracking-tight"
            >
              Raporty
            </h2>
            <ul className="mt-4 max-w-[68ch] space-y-2">
              {area.reports.map((r, i) => (
                <li key={i}>
                  {r.url ? (
                    <ExternalLink
                      href={r.url}
                      className="inline-flex min-h-11 items-center font-semibold"
                    >
                      {r.title}
                    </ExternalLink>
                  ) : (
                    <span className="font-semibold">{r.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="border-hairline mt-14 space-y-1 border-t pt-6">
          {area ? (
            <SourceLine
              source={sourceName}
              href={source?.url}
              detail={pages ? `s. ${pages}` : null}
              date={source?.date}
            />
          ) : null}
          <SourceLine
            label="Rozwiązania"
            source="Biblioteka Innowacji Społecznych, ROPS w Krakowie"
            href={`/library?area=${key}`}
          />
        </div>

        <nav aria-labelledby="other-areas" className="mt-12">
          <h2 id="other-areas" className="font-display text-xl font-bold">
            Inne obszary
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((a) => (
              <li key={a}>
                <Link
                  href={`/knowledge/${a}`}
                  className="border-input hover:bg-surface inline-flex min-h-11 max-w-full items-center rounded-md border px-3 text-[0.9375rem] font-semibold no-underline [overflow-wrap:anywhere]"
                >
                  {MAPA_AREA_LABEL[a]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
