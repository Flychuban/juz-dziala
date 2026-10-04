import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "~/components/kit";
import { IdeaWizard } from "~/components/ideas/idea-wizard";
import type { IdeaStage } from "~/lib/domain";
import { optionValue, STAGE_TO_READINESS } from "~/server/ideas/canvas-def";
import { applicationCall, gminaOptions, loadCanvasView } from "~/server/ideas/data";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ideas.meta");
  return { title: t("newTitle"), description: t("newDescription") };
}

export const dynamic = "force-dynamic";

export default async function Page() {
  const locale = await getLocale();
  const t = await getTranslations("ideas.new");
  const [{ gminas, powiaty }, criteria, canvas, call] = await Promise.all([
    gminaOptions(),
    api.ideas.criteria(),
    loadCanvasView(locale),
    applicationCall(),
  ]);

  // The stage hints are the canvas „Gotowość do wdrożenia" descriptions (INNO AGH).
  const readiness = canvas?.sheets
    .flatMap((s) => s.sections)
    .flatMap((s) => s.fields)
    .find((f) => f.key === "readiness");
  const stageHints: Partial<Record<IdeaStage, string>> = {};
  for (const [stage, label] of Object.entries(STAGE_TO_READINESS) as [IdeaStage, string][]) {
    const d = readiness?.options.find((o) => optionValue(o) === label)?.description;
    if (d) stageHints[stage] = d;
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={<p>{t("lead")}</p>}
        breadcrumbs={[{ label: t("home"), href: "/" }]}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <IdeaWizard gminas={gminas} powiaty={powiaty} criteria={criteria} stageHints={stageHints} canApply={!!call} />
      </div>
    </>
  );
}
