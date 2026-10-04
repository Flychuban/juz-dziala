import { type Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FlaskConicalIcon, SearchXIcon, StarIcon } from "lucide-react";

import { AreaTag, EmptyState, PageHeader, SourceLine } from "~/components/kit";
import { RateWizard, TestSignUpWizard } from "~/components/tests/tester-forms";
import { TestableCard } from "~/components/tests/testable-card";
import { Button } from "~/components/ui/button";
import { gminaOptions } from "~/server/ideas/data";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tester.meta");
  return { title: t("title"), description: t("description") };
}

export const dynamic = "force-dynamic";

const LIBRARY_URL = "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

function one(v: string | string[] | undefined) {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s?.length ? s : undefined;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, t] = await Promise.all([searchParams, getTranslations("tester.page")]);
  const slug = one(sp.innovation)?.slice(0, 200);
  const mode = one(sp.mode);

  if (slug) {
    const [inn, { gminas, powiaty }] = await Promise.all([api.tests.bySlug({ slug }), gminaOptions()]);
    if (!inn) {
      return (
        <>
          <PageHeader eyebrow={t("eyebrow")} title={t("title")} breadcrumbs={[{ label: t("title"), href: "/test" }]} />
          <div className="mx-auto max-w-4xl px-4 py-10">
            <EmptyState
              icon={<SearchXIcon />}
              title={t("notFound.title")}
              description={<p>{t("notFound.body")}</p>}
              action={
                <Button asChild>
                  <Link href="/test">{t("notFound.toList")}</Link>
                </Button>
              }
            />
          </div>
        </>
      );
    }
    const lang = inn.lang === "pl" ? "pl" : undefined;
    const back = `/test?innovation=${encodeURIComponent(inn.slug)}`;
    const innovation = { id: inn.id, title: inn.title, lang: inn.lang };
    return (
      <>
        <PageHeader
          eyebrow={t("eyebrow")}
          title={mode === "signup" ? t("signUpTitle") : mode === "rate" ? t("rateTitle") : <span lang={lang}>{inn.title}</span>}
          lead={mode === "signup" || mode === "rate" ? <p lang={lang}>„{inn.title}”</p> : <p lang={lang}>{inn.summary}</p>}
          breadcrumbs={[{ label: t("title"), href: "/test" }]}
          width="narrow"
        >
          <div className="mt-4 flex flex-wrap gap-2">
            {inn.areas.map((a) => (
              <AreaTag key={a} area={a} />
            ))}
          </div>
          <SourceLine className="mt-4" source={t("source")} href={inn.sourceUrl} date={inn.capturedAt} />
        </PageHeader>
        <div className="mx-auto max-w-4xl px-4 py-10 md:py-12">
          {mode === "signup" ? (
            <>
              {!inn.testingOpen ? (
                <p role="note" className="border-hairline mb-8 border-l-4 py-1 pl-4">
                  {t("notOpen")}
                </p>
              ) : null}
              <TestSignUpWizard innovation={innovation} gminas={gminas} powiaty={powiaty} backHref={back} />
            </>
          ) : mode === "rate" ? (
            <RateWizard innovation={innovation} backHref={back} />
          ) : (
            <section aria-labelledby="choose-h" className="flex flex-col gap-6">
              <h2 id="choose-h" className="font-display text-2xl font-bold">
                {t("choose.heading")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                  href={`${back}&mode=signup`}
                  className="border-input hover:bg-surface flex min-h-24 flex-col gap-2 rounded-lg border-2 p-5"
                >
                  <span className="flex items-center gap-2 text-xl font-bold">
                    <FlaskConicalIcon aria-hidden="true" className="size-6" />
                    {t("choose.signUp")}
                  </span>
                  <span>{t("choose.signUpHint")}</span>
                </Link>
                <Link href={`${back}&mode=rate`} className="border-input hover:bg-surface flex min-h-24 flex-col gap-2 rounded-lg border-2 p-5">
                  <span className="flex items-center gap-2 text-xl font-bold">
                    <StarIcon aria-hidden="true" className="size-6" />
                    {t("choose.rate")}
                  </span>
                  <span>{t("choose.rateHint")}</span>
                </Link>
              </div>
              <p>
                <Link href={`/library/${inn.slug}`} className="text-primary font-semibold underline underline-offset-4">
                  {t("choose.card")}
                </Link>
              </p>
            </section>
          )}
        </div>
      </>
    );
  }

  const list = await api.tests.list();
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={<p>{t("lead")}</p>} />
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-10 md:py-12">
        <section aria-labelledby="open-h">
          <h2 id="open-h" className="font-display text-2xl font-bold">
            {t("open.heading")}
          </h2>
          {list.open.length ? (
            <>
              <p className="mt-2 max-w-prose">{t("open.body")}</p>
              <p className="text-muted-foreground mt-2">{t("count", { count: list.open.length })}</p>
              <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.open.map((i) => (
                  <li key={i.id}>
                    <TestableCard item={i} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              className="mt-6"
              icon={<FlaskConicalIcon />}
              title={t("open.emptyTitle")}
              description={<p>{t("open.emptyBody")}</p>}
            />
          )}
        </section>

        {list.candidates.length ? (
          <section aria-labelledby="candidates-h">
            <h2 id="candidates-h" className="font-display text-2xl font-bold">
              {t("candidates.heading")}
            </h2>
            <p role="note" className="border-hairline mt-4 max-w-prose border-l-4 py-1 pl-4">
              {t("candidates.note")}
            </p>
            <p className="text-muted-foreground mt-4">{t("count", { count: list.candidates.length })}</p>
            <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.candidates.map((i) => (
                <li key={i.id}>
                  <TestableCard item={i} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!list.open.length && !list.candidates.length ? (
          <EmptyState
            icon={<FlaskConicalIcon />}
            title={t("none.title")}
            description={<p>{t("none.body")}</p>}
            action={
              <Button asChild>
                <Link href="/library">{t("none.toLibrary")}</Link>
              </Button>
            }
          />
        ) : null}
        <SourceLine source={t("source")} href={LIBRARY_URL} />
      </div>
    </>
  );
}
