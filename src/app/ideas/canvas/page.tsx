import { type Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LightbulbIcon } from "lucide-react";

import { formatDate, PageHeader, SourceLine } from "~/components/kit";
import { CanvasBlank } from "~/components/ideas/canvas-blank";
import { CANVAS_PRINT_CSS } from "~/components/ideas/canvas-print";
import { IdeaNotFound } from "~/components/ideas/idea-not-found";
import { PrintButton } from "~/components/ideas/print-button";
import { Button } from "~/components/ui/button";
import { loadCanvasView } from "~/server/ideas/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ideas.meta");
  return { title: t("blankTitle"), description: t("blankDescription") };
}

/**
 * /ideas/canvas — the Social Innovation Canvas as blank, printable sheets with
 * every prompt. No case and no idea needed: for anyone who wants to think an
 * idea through on paper first (linked from /ideas/new and /learn).
 */
export default async function Page() {
  const locale = await getLocale();
  const t = await getTranslations("ideas.blank");
  const tc = await getTranslations("ideas.canvas");
  const def = await loadCanvasView(locale);
  if (!def) return <IdeaNotFound title={t("title")} message={tc("unavailable")} />;

  const credit = tc("credit", {
    publisher: def.source.publisher.split(" (")[0] ?? def.source.publisher,
    version: def.source.version ?? "—",
    date: formatDate(def.source.versionDate, locale),
    basedOn: def.source.basedOn,
  });

  return (
    <>
      <style>{CANVAS_PRINT_CSS}</style>
      <PageHeader
        className="print:hidden"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={<p>{t("lead")}</p>}
        breadcrumbs={[{ label: t("crumb"), href: "/ideas/new" }]}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <PrintButton label={t("print")} />
          <Button asChild variant="outline">
            <Link href="/ideas/new">
              <LightbulbIcon aria-hidden="true" />
              {t("toWizard")}
            </Link>
          </Button>
        </div>
        <SourceLine
          className="mt-6"
          source={tc("source", { version: def.source.version ?? "—", date: formatDate(def.source.versionDate, locale) })}
          href={def.source.url}
          detail={locale === "en" ? null : tc("sourceDetail")}
          date={def.source.capturedAt}
        />
      </PageHeader>
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12 print:max-w-none print:p-0">
        <CanvasBlank def={def} credit={credit} />
      </div>
    </>
  );
}
