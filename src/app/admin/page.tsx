import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Pulpit } from "~/components/cases/staff/pulpit";
import { api, HydrateClient } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.pulpit");
  return { title: t("metaTitle") };
}

const FLOW = ["step1", "step2", "step3", "step4"] as const;

export default async function Page() {
  const t = await getTranslations("admin");
  await Promise.all([
    api.admin.inbox.stats.prefetch(),
    api.admin.trends.whiteSpots.prefetch({ days: 30 }),
  ]);
  return (
    <HydrateClient>
      <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
        <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {t("header.eyebrow")}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{t("pulpit.title")}</h1>
        <p className="mt-2 max-w-prose">{t("pulpit.lead")}</p>

        {/* §6 — how a case reaches the team, in one calm list. */}
        <section aria-labelledby="flow-heading" className="mt-6 max-w-4xl">
          <h2 id="flow-heading" className="font-semibold">
            {t("pulpit.flow.heading")}
          </h2>
          <ol className="text-muted-foreground mt-2 grid gap-x-8 gap-y-1 text-[0.9375rem] md:grid-cols-2">
            {FLOW.map((k, i) => (
              <li key={k} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="text-foreground font-semibold tabular-nums"
                >
                  {i + 1}.
                </span>
                <span>{t(`pulpit.flow.${k}`)}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8">
          <Pulpit />
        </div>
      </div>
    </HydrateClient>
  );
}
