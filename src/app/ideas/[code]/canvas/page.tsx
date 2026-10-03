import { type Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, FolderOpenIcon } from "lucide-react";

import { formatDatePl, PageHeader, SourceLine } from "~/components/kit";
import { CanvasEditor } from "~/components/ideas/canvas-editor";
import { IdeaNotFound } from "~/components/ideas/idea-not-found";
import { Button } from "~/components/ui/button";
import { canvasFromIdea } from "~/server/ideas/canvas-def";
import { applicationCall, loadCanvasDef } from "~/server/ideas/data";
import { loadIdeaForPage, tokenParam, withToken } from "~/server/ideas/page-load";

export const metadata: Metadata = {
  title: "Canvas innowacji społecznej",
  description: "Rozpisz pomysł na trzech arkuszach Social Innovation Canvas INNO AGH i wydrukuj go.",
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
  const [loaded, def, call] = await Promise.all([loadIdeaForPage(raw, token), loadCanvasDef(), applicationCall()]);
  if (!loaded.ok) return <IdeaNotFound title="Canvas innowacji społecznej" message={loaded.message} />;
  if (!def) return <IdeaNotFound title="Canvas innowacji społecznej" message="Canvas jest chwilowo niedostępny. Spróbuj później." />;

  const { data, code } = loaded;
  const initial = data.canvas ?? canvasFromIdea({ ...data.idea, stage: data.idea.stage ?? undefined });

  return (
    <>
      <PageHeader
        eyebrow="Kreator pomysłów · Canvas"
        title="Canvas innowacji społecznej"
        lead={
          <p>
            Pomysł „{data.idea.title}” (sprawa {code}). Trzy arkusze pomagają przemyśleć problem, odbiorców, koszty, partnerów i wpływ.
            {data.canvas ? " Wczytaliśmy Twój zapisany Canvas." : " Część pól wypełniliśmy z Twojej fiszki — sprawdź je."}
          </p>
        }
        breadcrumbs={[
          { label: "Mam pomysł", href: "/ideas/new" },
          { label: `Sprawa ${code}`, href: withToken(`/case/${code}`, token) },
        ]}
      >
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link href={withToken(`/case/${code}`, token)}>
              <FolderOpenIcon aria-hidden="true" />
              Wróć do sprawy
            </Link>
          </Button>
          {call ? (
            <Button asChild variant="secondary">
              <Link href={withToken(`/ideas/${code}/application`, token)}>
                Przygotuj szkic wniosku
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
        <SourceLine
          className="mt-6"
          source={`Social Innovation Canvas — INNO AGH, wersja ${def.source.version ?? "—"} z ${formatDatePl(def.source.versionDate)}, na podstawie Social Innovation Canvas The New Global School`}
          href={def.source.url}
          date={def.source.capturedAt}
        />
      </PageHeader>
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-12 print:max-w-none print:p-0">
        <CanvasEditor def={def} code={code} token={token} title={data.idea.title} initial={initial} />
      </div>
    </>
  );
}
