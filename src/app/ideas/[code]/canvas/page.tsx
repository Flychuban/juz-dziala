import { type Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRightIcon, FolderOpenIcon } from "lucide-react";

import { formatDate, PageHeader, SourceLine } from "~/components/kit";
import { CanvasEditor } from "~/components/ideas/canvas-editor";
import { IdeaNotFound } from "~/components/ideas/idea-not-found";
import { Button } from "~/components/ui/button";
import { canvasFromIdea } from "~/server/ideas/canvas-def";
import { applicationCall, loadCanvasView } from "~/server/ideas/data";
import { loadIdeaForPage, tokenParam, withToken } from "~/server/ideas/page-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ideas.meta");
  return { title: t("canvasTitle"), description: t("canvasDescription") };
}

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp, locale, t, tc] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations("ideas.canvasPage"),
    getTranslations("ideas.canvas"),
  ]);
  const token = tokenParam(sp);
  const [loaded, def, call] = await Promise.all([loadIdeaForPage(raw, token), loadCanvasView(locale), applicationCall()]);
  if (!loaded.ok) return <IdeaNotFound title={t("title")} message={loaded.message} />;
  if (!def) return <IdeaNotFound title={t("title")} message={tc("unavailable")} />;

  const { data, code } = loaded;
  const initial = data.canvas ?? canvasFromIdea({ ...data.idea, stage: data.idea.stage ?? undefined });

  return (
    <>
      <PageHeader
        className="print:hidden"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={
          <p>
            {t("lead", { title: data.idea.title, code })} {data.canvas ? t("loaded") : t("prefilled")}
          </p>
        }
        breadcrumbs={[
          { label: t("crumbIdeas"), href: "/ideas/new" },
          { label: t("crumbCase", { code }), href: withToken(`/case/${code}`, token) },
        ]}
      >
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link href={withToken(`/case/${code}`, token)}>
              <FolderOpenIcon aria-hidden="true" />
              {t("backToCase")}
            </Link>
          </Button>
          {call ? (
            <Button asChild variant="secondary">
              <Link href={withToken(`/ideas/${code}/application`, token)}>
                {t("toApplication")}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
        <SourceLine
          className="mt-6"
          source={tc("source", { version: def.source.version ?? "—", date: formatDate(def.source.versionDate, locale) })}
          href={def.source.url}
          detail={locale === "en" ? null : tc("sourceDetail")}
          date={def.source.capturedAt}
        />
      </PageHeader>
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-12 print:max-w-none print:p-0">
        <CanvasEditor def={def} code={code} token={token} title={data.idea.title} initial={initial} />
      </div>
    </>
  );
}
