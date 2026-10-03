import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AwardIcon,
  DownloadIcon,
  FileTextIcon,
  MapPinIcon,
} from "lucide-react";
import { cache } from "react";

import {
  AreaTag,
  EasyText,
  ExternalLink,
  PageHeader,
  ReadAloud,
  SampleBadge,
  SourceLine,
  VideoEmbed,
} from "~/components/kit";
import { PowiatMap } from "~/components/map";
import { Button } from "~/components/ui/button";
import { SECTION_KEYS, SECTION_LABEL } from "~/lib/domain";
import { api } from "~/trpc/server";

type Params = Promise<{ slug: string }>;

const getCard = cache((slug: string) => api.library.bySlug({ slug }));

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCard(decodeURIComponent(slug));
  if (!card) return { title: "Nie znaleziono karty" };
  return { title: card.title, description: card.summary };
}

const STAGE_LABEL: Record<string, string> = {
  test: "testowanie",
  pilot: "pilotaż",
  implemented: "wdrożenie",
  implementation: "wdrożenie",
  scaled: "upowszechnienie",
};

/** Card text: paragraphs on blank lines, „- " / „• " lines as a list. */
function CardText({ text }: { text: string }) {
  const blocks = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul
          key={`l${out.length}`}
          className="marker:text-primary list-disc space-y-1.5 pl-6"
        >
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  let bulletNext = false;
  for (const b of blocks) {
    // Some cards put the list marker on its own line: „-" then the item.
    if (/^[-–•·*]$/u.test(b)) {
      bulletNext = true;
      continue;
    }
    const m = /^[-–•·*]\s*(.+)$/u.exec(b);
    if (m?.[1] ?? bulletNext) list.push(m?.[1] ?? b);
    else {
      flush();
      out.push(<p key={`p${out.length}`}>{b}</p>);
    }
    bulletNext = false;
  }
  flush();
  return <div className="max-w-[68ch] space-y-4">{out}</div>;
}

export default async function InnovationPage({ params }: { params: Params }) {
  const { slug } = await params;
  const card = await getCard(decodeURIComponent(slug));
  if (!card) notFound();

  const sitePowiaty = [
    ...new Set(
      card.sites.map((s) => s.powiatTeryt).filter((x): x is string => !!x),
    ),
  ];
  const isZip = card.materialsUrl?.toLowerCase().endsWith(".zip");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Biblioteka Innowacji Społecznych", href: "/library" },
        ]}
        eyebrow={card.categoryLabels.join(" · ") || "Innowacja społeczna"}
        title={card.title}
        lead={
          // Only when the summary is shorter than the section it opens.
          (card.sections.solution ?? "").trim().length >
          card.summary.length + 40 ? (
            <p>{card.summary}</p>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {card.mapaAreas.map((a) => (
            <AreaTag key={a} area={a} href={`/library?area=${a}`} />
          ))}
          {card.badge ? (
            <span className="border-brand-accent text-brand-accent bg-background inline-flex min-h-11 items-center gap-2 rounded-sm border px-3 text-sm font-bold">
              <AwardIcon aria-hidden="true" className="size-5 shrink-0" />
              <span>
                Wybrana do upowszechniania
                <span className="sr-only">: {card.badge}</span>
              </span>
            </span>
          ) : null}
        </div>
      </PageHeader>

      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 px-4 py-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        {/* Actions first in reading order; to the right on wide screens. */}
        <aside
          aria-labelledby="actions-heading"
          className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start"
        >
          <div className="border-hairline rounded-lg border p-5">
            <h2 id="actions-heading" className="font-display text-xl font-bold">
              Co możesz zrobić
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <Link
                  href={`/adapt?innovation=${encodeURIComponent(card.slug)}`}
                >
                  Chcę to wdrożyć
                </Link>
              </Button>
              <p className="text-foreground/85 -mt-1 text-[0.9375rem] leading-snug">
                Dla gminy lub organizacji: plan wdrożenia u Ciebie.
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link
                  href={`/test?innovation=${encodeURIComponent(card.slug)}`}
                >
                  Testuj / oceń
                </Link>
              </Button>
              <ReadAloud
                text={`${SECTION_LABEL.solution} ${card.sections.solution ?? ""}`}
                className="w-full"
              />
            </div>
            {card.folderUrl || card.materialsUrl ? (
              <div className="border-hairline mt-5 border-t pt-4">
                <h3 className="text-base font-bold">Do pobrania</h3>
                <ul className="mt-2 space-y-1">
                  {card.folderUrl ? (
                    <li>
                      <a
                        href={card.folderUrl}
                        className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-1 underline-offset-4"
                      >
                        <FileTextIcon
                          aria-hidden="true"
                          className="text-primary size-5 shrink-0"
                        />
                        Pobierz folder (PDF)
                      </a>
                    </li>
                  ) : null}
                  {card.materialsUrl ? (
                    <li>
                      <a
                        href={card.materialsUrl}
                        className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-1 underline-offset-4"
                      >
                        <DownloadIcon
                          aria-hidden="true"
                          className="text-primary size-5 shrink-0"
                        />
                        {isZip ? "Materiały (plik ZIP)" : "Materiały"}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>

        <article className="min-w-0 lg:col-start-1 lg:row-start-1">
          <EasyText slug={card.slug} title={card.title} className="mb-10" />
          {card.videoUrl ? (
            <section aria-labelledby="video-heading" className="mb-12">
              <h2 id="video-heading" className="sr-only">
                Film o rozwiązaniu
              </h2>
              <VideoEmbed url={card.videoUrl} title={card.title} />
            </section>
          ) : null}

          {SECTION_KEYS.map((key, i) => {
            const text = card.sections[key]?.trim();
            return (
              <section
                key={key}
                aria-labelledby={`section-${key}`}
                className={i > 0 ? "border-hairline mt-10 border-t pt-8" : ""}
              >
                <h2
                  id={`section-${key}`}
                  className="font-display text-2xl leading-tight font-bold tracking-tight"
                >
                  {SECTION_LABEL[key]}
                </h2>
                <div className="mt-4">
                  {text ? (
                    <CardText text={text} />
                  ) : (
                    <p className="text-muted-foreground">
                      Karta nie zawiera tej informacji.
                    </p>
                  )}
                </div>
              </section>
            );
          })}


          <section
            aria-labelledby="sites-heading"
            className="border-hairline mt-10 border-t pt-8"
          >
            <h2
              id="sites-heading"
              className="font-display text-2xl leading-tight font-bold tracking-tight"
            >
              Działa już w
            </h2>
            {card.sites.length > 0 ? (
              <>
                <ul className="mt-4 space-y-3">
                  {card.sites.map((s) => (
                    <li key={s.id} className="flex gap-3">
                      <MapPinIcon
                        aria-hidden="true"
                        className="text-primary mt-1 size-5 shrink-0"
                      />
                      <div>
                        <p className="font-semibold">
                          {s.place} {s.isSample ? <SampleBadge /> : null}
                        </p>
                        <p className="text-foreground/85 text-[0.9375rem]">
                          Etap: {STAGE_LABEL[s.stage] ?? s.stage}
                          {s.sourceUrl ? (
                            <>
                              {" · "}
                              <a
                                href={s.sourceUrl}
                                className="underline decoration-1 underline-offset-4"
                              >
                                źródło
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {sitePowiaty.length > 0 ? (
                  <div className="mt-8">
                    <PowiatMap
                      label="Liczba miejsc, w których działa to rozwiązanie"
                      valueLabel="Miejsca"
                      values={Object.fromEntries(
                        sitePowiaty.map((p) => [
                          p,
                          card.sites.filter((s) => s.powiatTeryt === p).length,
                        ]),
                      )}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-foreground/85 mt-4">
                Brak informacji o wdrożeniach w karcie.
              </p>
            )}
          </section>

          {card.orgs.length > 0 ? (
            <section
              aria-labelledby="orgs-heading"
              className="border-hairline mt-10 border-t pt-8"
            >
              <h2
                id="orgs-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight"
              >
                {card.orgs.length === 1 ? "Organizacja" : "Organizacje"}
              </h2>
              <ul className="mt-4 space-y-2">
                {card.orgs.map((o) => (
                  <li key={o.id}>
                    <span className="font-semibold">{o.name}</span>
                    {o.type ? (
                      <span className="text-foreground/85"> · {o.type}</span>
                    ) : null}{" "}
                    {o.isSample ? <SampleBadge /> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-4">
                <Link
                  href="/network"
                  className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
                >
                  Zobacz sieć organizacji i mentorów
                </Link>
              </p>
            </section>
          ) : null}

          <section
            aria-labelledby="licence-heading"
            className="border-hairline mt-10 border-t pt-8"
          >
            <h2 id="licence-heading" className="font-display text-xl font-bold">
              Licencja i źródło
            </h2>
            <p className="mt-3">
              Licencja:{" "}
              {card.licence ? (
                card.licenceUrl ? (
                  <ExternalLink
                    href={card.licenceUrl}
                    className="font-semibold"
                  >
                    {card.licence}
                  </ExternalLink>
                ) : (
                  <span className="font-semibold">{card.licence}</span>
                )
              ) : (
                <span className="text-muted-foreground">
                  nie podano w karcie
                </span>
              )}
            </p>
            <SourceLine
              className="mt-2"
              source="Biblioteka Innowacji Społecznych, ROPS w Krakowie"
              href={card.sourceUrl}
              date={card.capturedAt}
            />
          </section>
        </article>
      </div>
    </>
  );
}
