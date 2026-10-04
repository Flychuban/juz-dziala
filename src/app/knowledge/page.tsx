import { type Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader, SourceLine } from "~/components/kit";
import { api } from "~/trpc/server";
import { RegionFiguresBlock } from "./_components/region-figures";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("knowledge.index");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function KnowledgePage() {
  const [data, t, locale] = await Promise.all([
    api.knowledge.areas(),
    getTranslations("knowledge.index"),
    getLocale(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={<p>{t("lead")}</p>}
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {!data.available ? (
          <p
            role="note"
            className="border-input bg-surface mb-8 max-w-[68ch] rounded-md border border-dashed px-4 py-3"
          >
            {t("unavailable")}
          </p>
        ) : null}

        <h2 className="sr-only">{t("areasHeading")}</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.areas.map((a, i) => (
            <li key={a.key}>
              <article className="group border-hairline hover:border-input focus-within:border-input relative flex h-full flex-col rounded-lg border p-5 transition-colors">
                <p
                  aria-hidden="true"
                  className="text-muted-foreground tabular text-sm font-bold"
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="font-display mt-1 text-xl leading-snug font-bold tracking-tight">
                  <Link
                    href={`/knowledge/${a.key}`}
                    className="text-foreground decoration-primary decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-lg"
                  >
                    {a.label}
                  </Link>
                </h3>
                {a.firstChallenge ? (
                  <p
                    className="text-foreground/85 mt-3 line-clamp-4 text-base leading-snug"
                    lang={locale === "en" && a.lang === "pl" ? "pl" : undefined}
                  >
                    <span className="sr-only">{t("keyChallengeSr")} </span>
                    {a.firstChallenge}
                  </p>
                ) : null}
                <div aria-hidden="true" className="min-h-5 flex-1" />
                <p className="border-hairline text-foreground flex items-center justify-between gap-2 border-t pt-3 text-[0.9375rem] font-semibold">
                  <span className="tabular">
                    {t("count", { count: a.innovationCount })}
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="text-primary size-5 transition-transform group-hover:translate-x-0.5"
                  />
                </p>
              </article>
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-1">
          {data.source ? (
            <SourceLine
              source={data.source.name}
              href={data.source.url}
              date={data.source.date}
            />
          ) : null}
          <SourceLine
            label={t("countLabel")}
            source={t("librarySource")}
            href="/library"
          />
        </div>

        {data.region ? (
          <RegionFiguresBlock
            data={data.region}
            variant="overview"
            className="mt-14"
          />
        ) : null}

        <Link
          href="/learn"
          className="group border-hairline hover:border-input mt-14 flex max-w-xl items-center gap-4 rounded-lg border p-5 no-underline"
        >
          <BookOpenIcon
            aria-hidden="true"
            className="text-primary size-8 shrink-0 stroke-[1.5]"
          />
          <span className="min-w-0">
            <span className="font-display block text-lg font-bold group-hover:underline">
              {t("learnTitle")}
            </span>
            <span className="text-foreground/85 block text-base">
              {t("learnBody")}
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
