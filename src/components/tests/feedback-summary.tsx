"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatDate, formatNumber } from "~/components/kit";
import { api } from "~/trpc/react";

/**
 * Staff view of what testers said about one innovation (`tests.summary`):
 * count, average, distribution and the comments grouped into themes by AI —
 * or, without the AI, simply listed. Drop it into an admin page:
 *
 *   <FeedbackSummary innovationId="c004" />
 */
export function FeedbackSummary({ innovationId }: { innovationId: string }) {
  const t = useTranslations("tester.summary");
  const locale = useLocale();
  const q = api.tests.summary.useQuery({ innovationId });
  if (q.isPending) return <p role="status">{t("loading")}</p>;
  if (q.isError) return <p role="alert">{t("error", { message: q.error.message })}</p>;
  const s = q.data;
  return (
    <section aria-labelledby={`fb-${innovationId}`} className="flex flex-col gap-4">
      <h2 id={`fb-${innovationId}`} className="font-display text-xl font-bold">
        {t("heading")}
      </h2>
      <p>
        {t("count")} <span className="tabular font-bold">{formatNumber(s.feedbackCount, locale)}</span>
        {s.averageRating !== null ? (
          <>
            {" "}
            · {t("average")} <span className="tabular font-bold">{formatNumber(s.averageRating, locale)} / 5</span>
          </>
        ) : null}{" "}
        · {t("signUps")} <span className="tabular font-bold">{formatNumber(s.testSignUps, locale)}</span>
      </p>
      {s.feedbackCount ? (
        <ul className="tabular flex flex-wrap gap-x-4 gap-y-1 text-[0.9375rem]">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <li key={n}>
              {n}/5: {s.ratingCounts[n]}
            </li>
          ))}
        </ul>
      ) : null}
      {s.themes?.length ? (
        <div>
          <h3 className="text-lg font-semibold">{t("themes")}</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {s.themes.map((th) => (
              <li key={th.name} className="border-hairline border-t pt-3">
                <p className="font-semibold">
                  {t(`kind.${th.kind}`)}: {th.name}
                </p>
                <p>{th.summary}</p>
                <p className="text-muted-foreground text-sm">{t("opinions", { codes: th.caseCodes.join(", ") })}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : s.aiStatus === "unavailable" || s.aiStatus === "failed" ? (
        <p className="text-muted-foreground">{t("aiUnavailable")}</p>
      ) : null}
      {s.comments.length ? (
        <details open={!s.themes?.length}>
          <summary className="min-h-12 cursor-pointer py-2 font-semibold">{t("all", { count: s.comments.length })}</summary>
          <ul className="mt-2 flex flex-col gap-3">
            {s.comments.map((c) => (
              <li key={c.code} className="border-hairline border-t pt-3">
                <p className="text-muted-foreground text-sm">
                  {c.code} · {formatDate(c.createdAt, locale)}
                  {c.rating ? ` · ${c.rating}/5` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p>{t("none")}</p>
      )}
    </section>
  );
}
