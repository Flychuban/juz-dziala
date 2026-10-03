import { type Metadata } from "next";
import Link from "next/link";
import { BellIcon, CalendarClockIcon, LayoutGridIcon } from "lucide-react";

import { EmptyState, formatDatePl, PageHeader, SourceLine } from "~/components/kit";
import { ApplicationGenerator } from "~/components/ideas/application-generator";
import { IdeaNotFound } from "~/components/ideas/idea-not-found";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { canvasToText } from "~/server/ideas/canvas-def";
import { applicationCall, loadCanvasDef } from "~/server/ideas/data";
import { loadIdeaForPage, tokenParam, withToken } from "~/server/ideas/page-load";

export const metadata: Metadata = {
  title: "Generator wniosku",
  description: "Szkic wniosku o grant na innowację społeczną, przygotowany z Twojej fiszki i Canvasu.",
};

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp] = await Promise.all([params, searchParams]);
  const token = tokenParam(sp);
  const [loaded, call, def] = await Promise.all([loadIdeaForPage(raw, token), applicationCall(), loadCanvasDef()]);
  if (!loaded.ok) return <IdeaNotFound title="Generator wniosku" message={loaded.message} />;
  const { data, code } = loaded;
  const caseHref = withToken(`/case/${code}`, token);

  const header = (
    <PageHeader
      eyebrow="Kreator pomysłów · Wniosek"
      title="Generator wniosku"
      lead={
        <p>
          Pomysł „{data.idea.title}” (sprawa {code}). Przygotujemy szkic wniosku o grant z tego, co już napisałaś/eś — resztę uzupełnisz sam(a).
        </p>
      }
      breadcrumbs={[
        { label: "Mam pomysł", href: "/ideas/new" },
        { label: `Sprawa ${code}`, href: caseHref },
      ]}
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={withToken(`/ideas/${code}/canvas`, token)}>
            <LayoutGridIcon aria-hidden="true" />
            {data.canvas ? "Popraw Canvas" : "Najpierw wypełnij Canvas (lepszy szkic)"}
          </Link>
        </Button>
      </div>
    </PageHeader>
  );

  if (!call) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-4 py-10">
          <EmptyState
            icon={<CalendarClockIcon />}
            title="Teraz nie trwa żaden nabór"
            description={<p>Generator wniosku działa tylko w czasie otwartego naboru. Zapisz się na powiadomienia — damy znać, gdy ROPS ogłosi nowy.</p>}
            action={
              <Button asChild>
                <Link href="/network#powiadomienia">
                  <BellIcon aria-hidden="true" />
                  Powiadom mnie o naborach
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const sources = [
    data.idea.title,
    data.idea.description,
    data.idea.targetGroup,
    def && data.canvas ? canvasToText(def, data.canvas) : "",
  ];

  return (
    <>
      {header}
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 md:py-12">
        {call.status === "demo" ? (
          <Alert role="note">
            <CalendarClockIcon aria-hidden="true" />
            <AlertTitle>Nabór przykładowy (demo){call.windowTo ? ` — trwa do ${formatDatePl(call.windowTo)}` : ""}</AlertTitle>
            <AlertDescription>
              To nabór demonstracyjny na potrzeby prototypu. Pola formularza i kryteria oceny skopiowaliśmy z naboru „Inkubator Włączenia Społecznego 2.0” (ROPS
              Kraków, FERS, Działanie 5.1).
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="note">
            <CalendarClockIcon aria-hidden="true" />
            <AlertTitle>
              {call.name}
              {call.windowTo ? ` — nabór trwa do ${formatDatePl(call.windowTo)}` : ""}
            </AlertTitle>
          </Alert>
        )}

        <section aria-labelledby="fields-h">
          <h2 id="fields-h" className="font-display text-2xl font-bold">
            Pola formularza ({call.formFields.length})
          </h2>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-6">
            {call.formFields.map((f) => (
              <li key={f.key}>
                <span className="font-semibold">{f.label}</span>
                {f.hint ? <span className="text-muted-foreground block text-[0.9375rem]">{f.hint}</span> : null}
              </li>
            ))}
          </ol>
          <SourceLine
            className="mt-4"
            source={call.status === "demo" ? "Wzór formularza aplikacyjnego IWS 2.0 (zał. 3 do ogłoszenia), ROPS Kraków" : call.name}
            href={call.status === "demo" ? "https://rops.krakow.pl/mpliki/IS/IWS_20/za._3._Formularz_aplikacyjny_wzor.pdf" : call.sourceUrl}
          />
        </section>

        <ApplicationGenerator
          code={code}
          token={token}
          call={{ id: call.id, name: call.name, formFields: call.formFields }}
          existing={data.idea.application}
          sources={sources}
        />
      </div>
    </>
  );
}
