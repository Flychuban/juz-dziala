import { type Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { EmptyState, PageHeader } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("knowledge.learn");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** The `kind` values of data/learn.json, grouped; display order. Unknown kinds go to "other". */
const KINDS = [
  { key: "report", values: ["report", "raport", "reports"] },
  {
    key: "tool",
    values: ["tool", "narzedzie", "narzędzie", "canvas", "tools"],
  },
  { key: "guide", values: ["guide", "przewodnik", "handbook", "manual"] },
  { key: "data", values: ["data", "dane", "dataset", "statystyki"] },
  { key: "video", values: ["video", "film", "videos", "webinar"] },
  { key: "course", values: ["course", "kurs", "training", "szkolenie"] },
  {
    key: "publication",
    values: ["article", "artykul", "artykuł", "publication", "publikacja"],
  },
] as const;
type KindKey = (typeof KINDS)[number]["key"] | "other";
const ORDER: KindKey[] = [...KINDS.map((k) => k.key), "other"];

function kindOf(kind: string | null | undefined): KindKey {
  const k = (kind ?? "").trim().toLowerCase();
  return (
    KINDS.find((g) => (g.values as readonly string[]).includes(k))?.key ??
    "other"
  );
}

const STEPS = ["diagnosis", "idea", "prototype", "test", "scale"] as const;

export default async function LearnPage() {
  const [{ items }, t, locale] = await Promise.all([
    api.knowledge.learn(),
    getTranslations("knowledge.learn"),
    getLocale(),
  ]);

  const groups = new Map<KindKey, typeof items>();
  for (const item of items) {
    const k = kindOf(item.kind);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  const ordered = ORDER.filter((k) => groups.has(k));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={
          <>
            <p>{t("lead")}</p>
            {locale === "en" && items.length > 0 ? (
              <p className="text-foreground/85 mt-2 text-base">
                {t("materialsLang")}
              </p>
            ) : null}
          </>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        {ordered.length > 0 ? (
          <div className="space-y-14">
            {ordered.map((kind) => (
              <section key={kind} aria-labelledby={`kind-${kind}`}>
                <h2
                  id={`kind-${kind}`}
                  className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
                >
                  {t(`kind.${kind}`)}
                </h2>
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.get(kind)!.map((item) => (
                    <li
                      key={item.url}
                      lang={
                        locale === "en" && item.lang === "pl" ? "pl" : undefined
                      }
                    >
                      <article className="group border-hairline hover:border-input focus-within:border-input relative flex h-full flex-col rounded-lg border p-5 transition-colors">
                        {item.publisher ? (
                          <p className="text-muted-foreground mb-2 text-sm font-bold tracking-wide">
                            {item.publisher}
                          </p>
                        ) : null}
                        <h3 className="font-display text-lg leading-snug font-bold">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            hrefLang="pl"
                            className="text-foreground decoration-primary decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-lg"
                          >
                            {item.title}
                            <span className="sr-only" lang={locale}>
                              {" "}
                              {t("newTab")}
                            </span>
                          </a>
                        </h3>
                        {item.description ? (
                          <p className="text-foreground/85 mt-2 line-clamp-4 text-base leading-snug">
                            {item.description}
                          </p>
                        ) : null}
                        <div aria-hidden="true" className="min-h-5 flex-1" />
                        <p
                          aria-hidden="true"
                          lang={locale}
                          className="border-hairline text-muted-foreground flex items-center gap-1.5 border-t pt-3 text-sm font-semibold"
                        >
                          <ExternalLinkIcon className="size-4" />
                          {t("publisherPage")}
                        </p>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpenIcon />}
            title={t("emptyTitle")}
            description={<p>{t("emptyBody")}</p>}
            action={
              <Button asChild>
                <Link href="/library">{t("toLibrary")}</Link>
              </Button>
            }
          />
        )}

        <section
          aria-labelledby="how-heading"
          className="border-hairline mt-16 border-t pt-10"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
            <div>
              <h2
                id="how-heading"
                className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl"
              >
                {t("howHeading")}
              </h2>
              <p className="text-foreground/85 mt-3">{t("howLead")}</p>
            </div>
            <ol className="max-w-[68ch] space-y-6">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="font-display text-primary tabular w-8 shrink-0 text-2xl leading-none font-bold"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold">
                      <span className="sr-only">
                        {t("stepSr", { n: i + 1 })}{" "}
                      </span>
                      {t(`steps.${step}.name`)}
                    </h3>
                    <p className="mt-1">{t(`steps.${step}.text`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}
