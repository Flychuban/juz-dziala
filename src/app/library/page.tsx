import { type Metadata } from "next";
import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchXIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  EmptyState,
  InnovationCard,
  PageHeader,
  SourceLine,
} from "~/components/kit";
import { Button } from "~/components/ui/button";
import { mapaAreaSchema } from "~/lib/domain";
import { highlightTerms, queryWords } from "~/server/library/search";
import { api } from "~/trpc/server";
import {
  ActiveFilters,
  libraryHref,
  LibraryFilters,
  type LibraryParams,
} from "./_components/filters";
import { LibrarySearchForm } from "./_components/search-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.list");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const LIBRARY_SOURCE =
  "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? undefined;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const [t, locale, facets] = await Promise.all([
    getTranslations("library.list"),
    getLocale(),
    api.library.facets(),
  ]);

  const area = mapaAreaSchema.safeParse(one(sp.area));
  const categoryRaw = one(sp.category);
  const category = facets.categories.find((c) => c.slug === categoryRaw);
  const q = one(sp.q)?.slice(0, 200) ?? "";
  const params: LibraryParams = {
    q: q || undefined,
    area: area.success ? area.data : undefined,
    category: category?.slug,
    video: one(sp.video) === "1",
  };

  const query = {
    q: params.q,
    area: params.area,
    category: params.category,
    hasVideo: params.video ? true : undefined,
  };
  let items = await api.library.list(query);
  const terms = highlightTerms(params.q, locale);
  // Nothing matched every word: show cards matching some of them, and say so.
  const partial = items.length === 0 && queryWords(params.q, locale).length > 1;
  if (partial) items = await api.library.list({ ...query, match: "any" });

  const PAGE_SIZE = 24;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageRaw = Number(one(sp.page) ?? 1);
  const page = Number.isInteger(pageRaw)
    ? Math.min(Math.max(pageRaw, 1), pageCount)
    : 1;
  const shown = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (n: number) => {
    const base = libraryHref(params);
    if (n <= 1) return base;
    return `${base}${base.includes("?") ? "&" : "?"}page=${n}`;
  };

  const filterCount =
    (params.area ? 1 : 0) + (params.category ? 1 : 0) + (params.video ? 1 : 0);
  const activeCount = filterCount + (params.q ? 1 : 0);
  const anyTranslated = items.some((i) => i.lang === "en");

  const filters = (
    <LibraryFilters
      params={params}
      areas={facets.areas}
      categories={facets.categories}
      withVideo={facets.withVideo}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={
          <>
            <p>{t("lead", { count: facets.total })}</p>
            {locale === "en" && anyTranslated ? (
              <p className="text-foreground/85 mt-2 text-base">
                {t("translated")}
              </p>
            ) : null}
          </>
        }
      >
        <LibrarySearchForm params={params} />
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-12">
        <aside aria-labelledby="filters-heading" className="hidden lg:block">
          <h2
            id="filters-heading"
            className="font-display mb-6 text-2xl font-bold"
          >
            {t("filtersHeading")}
          </h2>
          {filters}
        </aside>

        <div className="min-w-0">
          <details className="border-hairline group mb-8 rounded-lg border lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                {t("filtersSummary")}
                {filterCount > 0 ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    {t("filtersChosen", { count: filterCount })}
                  </span>
                ) : null}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-hairline border-t px-4 pt-5 pb-6">
              {filters}
            </div>
          </details>

          <div className="border-hairline mb-6 flex flex-col gap-3 border-b pb-5">
            <h2 className="sr-only">{t("resultsHeading")}</h2>
            <p
              role="status"
              aria-live="polite"
              className="font-display text-xl font-bold"
            >
              {t.rich("found", {
                count: items.length,
                num: (chunks) => <span className="tabular">{chunks}</span>,
              })}
              {params.q ? (
                <span className="font-normal">
                  {" "}
                  {t("forQuery", { q: params.q })}
                </span>
              ) : null}
              {pageCount > 1 ? (
                <span className="text-foreground/85 block text-base font-normal">
                  {t.rich("pageInfo", {
                    page,
                    pageCount,
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, items.length),
                    num: (chunks) => <span className="tabular">{chunks}</span>,
                  })}
                </span>
              ) : null}
            </p>
            {partial && items.length > 0 ? (
              <p className="border-input bg-surface rounded-md border border-dashed px-4 py-2 text-base">
                {t("partial")}
              </p>
            ) : null}
            <ActiveFilters params={params} categoryLabel={category?.label} />
          </div>

          {items.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
              {shown.map((item) => (
                <li
                  key={item.id}
                  lang={
                    locale === "en" && item.lang === "pl" ? "pl" : undefined
                  }
                >
                  <InnovationCard item={item} headingLevel="h3" terms={terms} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<SearchXIcon />}
              title={t("emptyTitle")}
              description={<p>{t("emptyBody")}</p>}
              action={
                <>
                  {activeCount > 0 ? (
                    <Button asChild variant="secondary">
                      <Link href="/library">{t("clearFilters")}</Link>
                    </Button>
                  ) : null}
                  <Button asChild>
                    <Link href="/">{t("describe")}</Link>
                  </Button>
                </>
              }
            />
          )}

          {pageCount > 1 ? (
            <nav aria-label={t("pagination")} className="mt-8">
              <ul className="flex flex-wrap items-center gap-2">
                {page > 1 ? (
                  <li>
                    <Button asChild variant="outline">
                      <Link href={pageHref(page - 1)}>
                        <ChevronLeftIcon aria-hidden="true" />
                        {t("prev")}
                      </Link>
                    </Button>
                  </li>
                ) : null}
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <Link
                      href={pageHref(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={
                        n === page
                          ? "border-primary bg-primary text-primary-foreground tabular inline-flex min-h-12 min-w-12 items-center justify-center rounded-md border font-semibold no-underline"
                          : "border-input hover:bg-surface tabular inline-flex min-h-12 min-w-12 items-center justify-center rounded-md border font-semibold no-underline"
                      }
                    >
                      <span className="sr-only">{t("pageSr")} </span>
                      {n}
                    </Link>
                  </li>
                ))}
                {page < pageCount ? (
                  <li>
                    <Button asChild variant="outline">
                      <Link href={pageHref(page + 1)}>
                        {t("next")}
                        <ChevronRightIcon aria-hidden="true" />
                      </Link>
                    </Button>
                  </li>
                ) : null}
              </ul>
            </nav>
          ) : null}

          <SourceLine
            className="mt-10"
            source={t("source")}
            href={LIBRARY_SOURCE}
          />
        </div>
      </div>
    </>
  );
}
