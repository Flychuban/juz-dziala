import { ArrowRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { MalopolskaOutline, powiatCount } from "~/components/match/malopolska-outline";
import { ProblemForm, type FormError } from "~/components/match/problem-form";
import { labelsFor } from "~/lib/domain";
import { gminas } from "~/server/match/data-files";
import { getLibrary } from "~/server/match/library";

export const dynamic = "force-dynamic";

/** Every other way in, one quiet list: modules III–VII one click from the home page. */
const DOORS = [
  { key: "idea", href: "/ideas/new" },
  { key: "municipality", href: "/municipality" },
  { key: "adapt", href: "/adapt" },
  { key: "expert", href: "/network#zapytaj" },
  { key: "network", href: "/network#partnerzy" },
  { key: "test", href: "/test" },
  { key: "case", href: "/case" },
] as const;

const FORM_ERRORS: readonly FormError[] = ["short", "long", "rate", "failed"];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const t = await getTranslations("home");
  const site = labelsFor(await getLocale()).site;
  const errorParam = (await searchParams).error;
  const initialError = FORM_ERRORS.find((e) => e === errorParam) ?? null;
  let cards: number | null = null;
  try {
    cards = (await getLibrary()).cards.length;
  } catch (e) {
    console.error("[home] library unavailable", e);
  }
  const options = gminas().map((g) => ({ teryt: g.teryt, name: g.name, kind: g.kind, powiatName: g.powiatName }));
  const powiaty = await powiatCount();
  const figures = [
    cards !== null ? t("figures.cards", { count: cards }) : null,
    powiaty !== null ? t("figures.powiaty", { count: powiaty }) : null,
    options.length > 0 ? t("figures.gminas", { count: options.length }) : null,
  ].filter((f): f is string => f !== null);

  return (
    <>
      <section aria-labelledby="home-title" className="border-hairline bg-surface border-b [overflow-wrap:anywhere]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-6 pb-10 md:pt-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14">
          <div className="min-w-0">
            <h1
              id="home-title"
              className="font-display text-[2.375rem] leading-[1.05] font-bold tracking-tight max-[22rem]:text-[1.75rem] sm:text-[3.25rem]"
            >
              {t("title")}
            </h1>
            <p className="text-foreground/85 mt-4 max-w-[48ch] text-xl leading-relaxed">{site.tagline}</p>
            {figures.length > 0 && <p className="text-foreground mt-4 font-semibold lg:hidden">{figures.join(" · ")}</p>}
            <div className="border-hairline bg-background mt-7 rounded-lg border p-5 max-[22rem]:border-0 max-[22rem]:bg-transparent max-[22rem]:p-0 sm:p-7">
              <ProblemForm gminas={options} initialError={initialError} />
            </div>
          </div>
          <figure className="hidden lg:mt-24 lg:block">
            <MalopolskaOutline className="h-auto w-full" />
            {figures.length > 0 && (
              <figcaption className="border-hairline mt-5 flex flex-col gap-1 border-t pt-4">
                <span className="sr-only">{t("figures.region")}</span>
                {figures.map((f) => (
                  <span key={f} className="font-display text-foreground text-xl font-bold">
                    {f}
                  </span>
                ))}
              </figcaption>
            )}
          </figure>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 [overflow-wrap:anywhere]">
        <p className="text-muted-foreground mt-6 max-w-3xl">
          {cards !== null ? t("trust.cards", { count: cards }) : t("trust.noCount")} · {t("trust.quote")} ·{" "}
          <Link href="/methodology" className="text-foreground underline underline-offset-4">
            {t("trust.how")}
          </Link>
        </p>

        <nav aria-labelledby="doors-heading" className="mt-14 mb-4">
          <h2 id="doors-heading" className="text-2xl font-bold">
            {t("doors.heading")}
          </h2>
          <ul className="border-hairline mt-5 grid grid-cols-1 border-t sm:grid-cols-2 sm:gap-x-8">
            {DOORS.map((d) => (
              <li key={d.key} className="border-hairline border-b">
                <Link
                  href={d.href}
                  className="group hover:bg-surface flex min-h-16 items-center justify-between gap-4 px-2 py-3 no-underline"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-foreground text-lg font-bold">{t(`doors.${d.key}.label`)}</span>
                    <span className="text-muted-foreground">{t(`doors.${d.key}.hint`)}</span>
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="text-primary size-5 shrink-0 transition-transform group-hover:translate-x-1 max-[22rem]:hidden"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
