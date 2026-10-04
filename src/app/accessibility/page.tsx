import { type Metadata } from "next";
import Link from "next/link";
import { LanguagesIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ExternalLink, PageHeader } from "~/components/kit";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.accessibility");
  return { title: t("metaTitle") };
}

/**
 * Deklaracja dostępności — structure required by art. 10 of the ustawa z 4 kwietnia 2019 r.
 * o dostępności cyfrowej (model: gov.pl). Facts a prototype cannot know are marked
 * „do uzupełnienia przez ROPS" instead of being invented. The English page is a
 * translation and says so first, with a link to the binding Polish version.
 */
export default async function AccessibilityPage() {
  const [t, locale] = await Promise.all([
    getTranslations("legal.accessibility"),
    getLocale(),
  ]);
  const em = (chunks: React.ReactNode) => <em>{chunks}</em>;

  return (
    <>
      <PageHeader
        width="narrow"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-10 text-lg [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-4 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:font-bold [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_li]:mt-1.5 [&_p+p]:mt-3 [&_p+ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul+p]:mt-4">
        {locale === "en" ? (
          <p className="flex items-start gap-3 text-xl font-semibold">
            <LanguagesIcon
              aria-hidden="true"
              className="text-primary mt-1 size-6 shrink-0"
            />
            <span>
              {t("translationNote")}{" "}
              <a href="/api/lang?to=pl&next=/accessibility" hrefLang="pl">
                {t("translationLink")}
              </a>
            </span>
          </p>
        ) : null}

        <p className="border-hairline bg-warning-bg rounded-md border p-4 text-base">
          {t("prototype")}
        </p>

        <section aria-labelledby="zakres">
          <h2 id="zakres">{t("scope.heading")}</h2>
          <ul>
            <li>{t("scope.name")}</li>
            <li>{t("scope.published")}</li>
            <li>{t("scope.updated")}</li>
          </ul>
        </section>

        <section aria-labelledby="status">
          <h2 id="status">{t("status.heading")}</h2>
          <p>
            {t.rich("status.body", {
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <h3 className="mt-4 text-xl font-semibold">
            {t("status.issuesHeading")}
          </h3>
          <ul>
            <li>{t("status.videos")}</li>
            <li>{t("status.pdfs")}</li>
            <li>
              {t.rich("status.pjm", {
                link: (chunks) => <Link href="/sign-language">{chunks}</Link>,
              })}
            </li>
            <li>{t("status.voice")}</li>
            <li>{t("status.translation")}</li>
          </ul>
        </section>

        <section aria-labelledby="przygotowanie">
          <h2 id="przygotowanie">{t("preparation.heading")}</h2>
          <ul>
            <li>{t("preparation.date")}</li>
            <li>{t("preparation.method")}</li>
          </ul>
        </section>

        <section aria-labelledby="ulatwienia">
          <h2 id="ulatwienia">{t("features.heading")}</h2>
          <ul>
            <li>{t("features.text")}</li>
            <li>{t("features.contrast")}</li>
            <li>{t("features.easy")}</li>
            <li>
              {t.rich("features.easyRead", {
                link: (chunks) => <Link href="/easy-read">{chunks}</Link>,
              })}
            </li>
            <li>{t("features.readAloud")}</li>
            <li>{t("features.forms")}</li>
            <li>{t("features.map")}</li>
            <li>{t("features.account")}</li>
            <li>{t("features.english")}</li>
          </ul>
        </section>

        <section aria-labelledby="skroty">
          <h2 id="skroty">{t("shortcuts.heading")}</h2>
          <p>{t("shortcuts.body")}</p>
        </section>

        <section aria-labelledby="kontakt">
          <h2 id="kontakt">{t("contact.heading")}</h2>
          <p>{t.rich("contact.body", { em })}</p>
        </section>

        <section aria-labelledby="procedura">
          <h2 id="procedura">{t("procedure.heading")}</h2>
          <p>
            {t.rich("procedure.body", {
              link: (chunks) => (
                <ExternalLink href="https://bip.brpo.gov.pl/">
                  {chunks}
                </ExternalLink>
              ),
            })}
          </p>
        </section>

        <section aria-labelledby="architektura">
          <h2 id="architektura">{t("building.heading")}</h2>
          <p>{t.rich("building.body", { em })}</p>
        </section>

        <section aria-labelledby="pjm">
          <h2 id="pjm">{t("interpreter.heading")}</h2>
          <p>{t.rich("interpreter.body", { em })}</p>
        </section>

        <section aria-labelledby="aplikacje">
          <h2 id="aplikacje">{t("apps.heading")}</h2>
          <p>{t("apps.body")}</p>
        </section>
      </div>
    </>
  );
}
