import { type Metadata } from "next";
import Link from "next/link";
import { CalendarClockIcon, MessageCircleQuestionIcon, UsersIcon } from "lucide-react";

import { AreaTag, countPl, EmptyState, ExternalLink, formatDatePl, PageHeader, SampleBadge, SourceLine } from "~/components/kit";
import { AskExpertWizard, SubscribeForm } from "~/components/network/network-forms";
import { Button } from "~/components/ui/button";
import { CALL_STATUS_LABEL, mapaAreaSchema } from "~/lib/domain";
import { gminaOptions } from "~/server/ideas/data";
import { ORG_TYPE_LABEL, ORG_TYPE_ORDER } from "~/server/ideas/network";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Sieć i mentorzy",
  description: "Organizacje, które stworzyły innowacje z Biblioteki, mentorzy i eksperci Hubu, otwarte nabory i powiadomienia.",
};

export const dynamic = "force-dynamic";

const LIBRARY_URL = "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

const ROLE_LABEL = { mentor: "Mentor(ka)", expert: "Ekspert(ka)", rops: "ROPS" } as const;

function callDates(from: string | null, to: string | null): string {
  if (from && to) return `od ${formatDatePl(from)} do ${formatDatePl(to)}`;
  if (to) return `do ${formatDatePl(to)}`;
  return "termin podany na stronie naboru";
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const areaParam = mapaAreaSchema.safeParse(typeof sp.area === "string" ? sp.area : undefined);
  const [orgs, people, calls, { gminas, powiaty }] = await Promise.all([
    api.network.orgs(),
    api.network.people(),
    api.network.openCalls(),
    gminaOptions(),
  ]);

  const groups = ORG_TYPE_ORDER.map((type) => ({ type, items: orgs.filter((o) => o.type === type) })).filter((g) => g.items.length);
  const other = orgs.filter((o) => !ORG_TYPE_ORDER.includes(o.type));
  if (other.length) groups.push({ type: "inna", items: other });

  const sections = [
    { id: "nabory", label: "Otwarte nabory" },
    { id: "zapytaj", label: "Zapytaj eksperta" },
    { id: "mentorzy", label: "Mentorzy i eksperci" },
    { id: "organizacje", label: "Organizacje" },
    { id: "powiadomienia", label: "Powiadomienia" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Komunikacja"
        title="Sieć i mentorzy"
        lead={
          <p>
            Kto w Małopolsce tworzy innowacje społeczne, kogo możesz zapytać o radę i jakie nabory trwają teraz. Zapisz się, a powiadomimy Cię o nowych
            naborach i rozwiązaniach.
          </p>
        }
      >
        <nav aria-label="Na tej stronie" className="mt-6">
          <ul className="flex flex-wrap gap-3">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="border-input bg-background hover:bg-surface inline-flex min-h-12 items-center rounded-md border-2 px-4 font-semibold">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 md:py-12">
        <section id="nabory" aria-labelledby="nabory-h" className="scroll-mt-6">
          <h2 id="nabory-h" className="font-display flex items-center gap-2 text-3xl font-bold">
            <CalendarClockIcon aria-hidden="true" className="size-7" />
            Otwarte nabory
          </h2>
          {calls.length ? (
            <ul className="mt-6 grid gap-5 md:grid-cols-2">
              {calls.map((c) => (
                <li key={c.id} className="border-hairline flex flex-col gap-2 rounded-lg border p-5">
                  <p className="text-muted-foreground text-sm font-semibold">{CALL_STATUS_LABEL[c.status]}</p>
                  <h3 className="font-display text-xl leading-snug font-bold">{c.name}</h3>
                  <p>
                    <span className="font-semibold">Termin: </span>
                    {callDates(c.windowFrom, c.windowTo)}
                  </p>
                  {c.eligibility.length ? (
                    <p>
                      <span className="font-semibold">Dla kogo: </span>
                      {c.eligibility.slice(0, 3).join("; ")}
                    </p>
                  ) : null}
                  {c.operator ? <p className="text-muted-foreground text-[0.9375rem]">Prowadzi: {c.operator}</p> : null}
                  <div className="mt-auto flex flex-wrap gap-3 pt-2">
                    {c.status === "demo" ? (
                      <Button asChild size="sm">
                        <Link href="/ideas/new">Zgłoś pomysł i przygotuj wniosek</Link>
                      </Button>
                    ) : null}
                    {c.sourceUrl ? <ExternalLink href={c.sourceUrl}>Strona naboru</ExternalLink> : null}
                  </div>
                  {c.sourceUrl && c.status !== "demo" ? <SourceLine source="ROPS Kraków — nabory" href={c.sourceUrl} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-6" icon={<CalendarClockIcon />} title="Teraz nie trwa żaden nabór" description={<p>Zapisz się niżej — damy znać, gdy ruszy nowy.</p>} />
          )}
        </section>

        <section id="zapytaj" aria-labelledby="zapytaj-h" className="scroll-mt-6">
          <h2 id="zapytaj-h" className="font-display flex items-center gap-2 text-3xl font-bold">
            <MessageCircleQuestionIcon aria-hidden="true" className="size-7" />
            Zapytaj eksperta
          </h2>
          <p className="mt-2 max-w-prose text-lg">Masz pytanie o usługę, projekt albo nabór? Zespół ROPS przekaże je ekspertowi z odpowiedniego obszaru.</p>
          <div className="mt-6">
            <AskExpertWizard gminas={gminas} powiaty={powiaty} initialArea={areaParam.success ? areaParam.data : undefined} />
          </div>
        </section>

        <section id="mentorzy" aria-labelledby="mentorzy-h" className="scroll-mt-6">
          <h2 id="mentorzy-h" className="font-display flex items-center gap-2 text-3xl font-bold">
            <UsersIcon aria-hidden="true" className="size-7" />
            Mentorzy i eksperci
          </h2>
          {people.length ? (
            <>
              <p className="mt-2 max-w-prose">
                W prototypie pokazujemy osoby przykładowe — nie są to prawdziwe dane. W wersji docelowej będą tu mentorzy i eksperci współpracujący z ROPS.
              </p>
              <ul className="mt-6 grid gap-5 md:grid-cols-2">
                {people.map((p) => (
                  <li key={p.id} className="border-hairline flex flex-col gap-2 rounded-lg border p-5">
                    <h3 className="font-display flex flex-wrap items-center gap-2 text-xl font-bold">
                      {p.displayName}
                      {p.isSample ? <SampleBadge /> : null}
                    </h3>
                    <p className="text-muted-foreground font-semibold">
                      {ROLE_LABEL[p.role]}
                      {p.title ? ` · ${p.title}` : ""}
                    </p>
                    {p.orgName ? <p>{p.orgName}</p> : null}
                    {p.bio ? <p>{p.bio}</p> : null}
                    {p.areas.length ? (
                      <div className="flex flex-wrap gap-2">
                        {p.areas.map((a) => (
                          <AreaTag key={a} area={a} />
                        ))}
                      </div>
                    ) : null}
                    <Button asChild size="sm" variant="secondary" className="mt-2 w-fit">
                      <Link href={`/network?area=${p.areas[0] ?? ""}#zapytaj`}>Zapytaj w tym obszarze</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState className="mt-6" icon={<UsersIcon />} title="Lista mentorów jest w przygotowaniu" description={<p>Pytanie możesz zadać już teraz — zespół ROPS dobierze eksperta.</p>} />
          )}
        </section>

        <section id="organizacje" aria-labelledby="organizacje-h" className="scroll-mt-6">
          <h2 id="organizacje-h" className="font-display text-3xl font-bold">
            Organizacje, które tworzą innowacje
          </h2>
          <p className="mt-2 max-w-prose">
            {countPl(orgs.length, "organizacja", "organizacje", "organizacji")} z kart Biblioteki Innowacji Społecznych — autorzy rozwiązań, które przetestowano w
            małopolskich inkubatorach. Osób prywatnych nie wymieniamy.
          </p>
          <div className="mt-6 flex flex-col gap-8">
            {groups.map((g) => (
              <section key={g.type} aria-labelledby={`org-${g.type}`}>
                <h3 id={`org-${g.type}`} className="font-display text-xl font-bold">
                  {ORG_TYPE_LABEL[g.type]?.many ?? "Inne"} <span className="text-muted-foreground tabular font-semibold">({g.items.length})</span>
                </h3>
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {g.items.map((o) => (
                    <li key={o.id} className="border-hairline rounded-md border p-3">
                      <p className="font-semibold">
                        {o.name} {o.isSample ? <SampleBadge /> : null}
                      </p>
                      {o.innovations.length ? (
                        <p className="mt-1 text-[0.9375rem]">
                          {o.innovations.length > 1 ? "Rozwiązania: " : "Rozwiązanie: "}
                          {o.innovations.map((i, idx) => (
                            <span key={i.id}>
                              {idx ? ", " : ""}
                              <Link href={`/library/${i.slug}`} className="text-primary underline underline-offset-4">
                                {i.title}
                              </Link>
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <SourceLine className="mt-6" source="Biblioteka Innowacji Społecznych ROPS Kraków (sekcja „Autorzy”)" href={LIBRARY_URL} />
        </section>

        <section id="powiadomienia" aria-labelledby="powiadomienia-h" className="scroll-mt-6">
          <h2 id="powiadomienia-h" className="font-display text-3xl font-bold">
            Powiadomienia
          </h2>
          <p className="mt-2 mb-6 max-w-prose text-lg">Powiadomimy Cię, gdy ROPS ogłosi nabór albo gdy w Bibliotece pojawi się nowe rozwiązanie w Twoim obszarze.</p>
          <SubscribeForm />
        </section>
      </div>
    </>
  );
}
