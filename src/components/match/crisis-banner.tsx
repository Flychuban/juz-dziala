import { useLocale, useTranslations } from "next-intl";

import { ExternalLink, formatDate } from "~/components/kit";
import { CRISIS_RESOURCES } from "~/server/domain/crisis";

/**
 * Shown first on the results page when the text suggests danger to life or
 * health. Calm, plain words; every number is a tel: link and carries the date
 * on which it was checked on the operator's own website. The heading takes
 * focus (tabIndex -1) so the numbers are the first thing read and seen.
 */
export function CrisisBanner({ headingRef }: { headingRef?: React.Ref<HTMLHeadingElement> }) {
  const t = useTranslations("match.crisis");
  const locale = useLocale();
  const verified = formatDate(CRISIS_RESOURCES[0]?.verifiedAt, locale);
  return (
    <section aria-labelledby="crisis-heading" className="border-foreground bg-warning-bg rounded-lg border-2 p-5">
      <h2 id="crisis-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none focus-visible:ring-2">
        {t("heading")}
      </h2>
      <p className="mt-2 max-w-prose">{t("body")}</p>
      <ul className="divide-hairline border-hairline mt-4 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
        {CRISIS_RESOURCES.map((r) => {
          const text = locale === "en" ? r.en : r;
          return (
            <li key={r.phone} className="py-3">
              <a
                href={`tel:${r.phone.replace(/\s+/gu, "")}`}
                className="text-foreground inline-flex min-h-12 items-center text-3xl font-bold tracking-wide"
              >
                {r.phone}
                <span className="sr-only">{t("call")}</span>
              </a>
              <p className="font-semibold">{text.name}</p>
              {text.hours && <p className="text-sm">{t("hours", { hours: text.hours })}</p>}
              <p className="text-muted-foreground text-sm">{text.who}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground mt-3 text-sm">
        {verified ? t("checked", { date: verified }) : t("checkedNoDate")}{" "}
        {CRISIS_RESOURCES.map((r, i) => (
          <span key={r.sourceUrl}>
            {i > 0 ? ", " : ""}
            <ExternalLink href={r.sourceUrl} className="text-muted-foreground">
              {new URL(r.sourceUrl).hostname}
            </ExternalLink>
          </span>
        ))}
        .
      </p>
    </section>
  );
}
