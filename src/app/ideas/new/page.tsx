import { type Metadata } from "next";

import { PageHeader } from "~/components/kit";
import { IdeaWizard } from "~/components/ideas/idea-wizard";
import type { IdeaStage } from "~/lib/domain";
import { STAGE_TO_READINESS } from "~/server/ideas/canvas-def";
import { applicationCall, gminaOptions, loadCanvasDef } from "~/server/ideas/data";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Mam pomysł",
  description: "Opisz pomysł na innowację społeczną: sprawdzimy, czy coś podobnego już działa, i pomożemy go dopracować.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ gminas, powiaty }, criteria, canvas, call] = await Promise.all([
    gminaOptions(),
    api.ideas.criteria(),
    loadCanvasDef(),
    applicationCall(),
  ]);

  // The stage hints are the canvas „Gotowość do wdrożenia" descriptions (INNO AGH).
  const readiness = canvas?.sheets
    .flatMap((s) => s.sections)
    .flatMap((s) => s.fields)
    .find((f) => f.key === "readiness");
  const stageHints: Partial<Record<IdeaStage, string>> = {};
  for (const [stage, label] of Object.entries(STAGE_TO_READINESS) as [IdeaStage, string][]) {
    const d = readiness?.options.find((o) => o.label === label)?.description;
    if (d) stageHints[stage] = d;
  }

  return (
    <>
      <PageHeader
        eyebrow="Kreator pomysłów"
        title="Mam pomysł"
        lead={
          <p>
            Opisz pomysł na innowację społeczną w czterech krokach. Sprawdzimy, czy coś podobnego już działa w Małopolsce, a asystent pomoże go
            dopracować. Pomysł trafi do zespołu ROPS jako sprawa z kodem.
          </p>
        }
        breadcrumbs={[{ label: "Strona główna", href: "/" }]}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <IdeaWizard gminas={gminas} powiaty={powiaty} criteria={criteria} stageHints={stageHints} canApply={!!call} />
      </div>
    </>
  );
}
