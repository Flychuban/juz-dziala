"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { SampleBadge, SourceLine } from "~/components/kit";
import { relativeAge } from "~/i18n/relative";
import { useLabels } from "~/i18n/use-labels";
import { CASE_KINDS, MAPA_AREAS } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

function Counter({
  label,
  value,
  href,
  hint,
  alert,
}: {
  label: string;
  value: number;
  href: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-hairline hover:bg-accent flex min-w-0 flex-col gap-1 rounded-lg border p-4 no-underline",
        alert && value > 0 && "border-destructive border-2",
      )}
    >
      <span className="text-foreground font-semibold">{label}</span>
      <span className="text-foreground font-display text-4xl font-bold tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground text-sm">{hint}</span>
    </Link>
  );
}

/** The ROPS pulpit: counters, this week's volume, latest cases. Refreshes every 10 s. */
export function Pulpit() {
  const t = useTranslations("admin.pulpit");
  const tl = useTranslations("admin.labels");
  const tt = useTranslations("common.time");
  const L = useLabels();
  const locale = useLocale();
  const q = api.admin.inbox.stats.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  if (q.isPending) return <p role="status">{t("loading")}</p>;
  if (q.error)
    return <p role="alert">{t("loadError", { message: q.error.message })}</p>;
  const s = q.data;
  const kinds = CASE_KINDS.filter((k) => s.week.byKind[k] > 0);
  const areas = MAPA_AREAS.filter((a) => s.week.byArea[a] > 0).sort(
    (a, b) => s.week.byArea[b] - s.week.byArea[a],
  );

  return (
    <div className="flex flex-col gap-12 [overflow-wrap:anywhere]">
      <section aria-labelledby="counters-heading">
        <h2 id="counters-heading" className="sr-only">
          {t("countersHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Counter
            label={t("counters.new")}
            value={s.newCount}
            href="/admin/cases?status=new"
            hint={t("counters.newHint")}
          />
          <Counter
            label={t("counters.waiting")}
            value={s.waitingOver48h}
            href="/admin/cases?waiting=1"
            hint={t("counters.waitingHint")}
            alert
          />
          <Counter
            label={t("counters.open")}
            value={s.openCount}
            href="/admin/cases"
            hint={t("counters.openHint")}
          />
          <Counter
            label={t("counters.unread")}
            value={s.unreadNotifications}
            href="/admin/cases"
            hint={t("counters.unreadHint")}
          />
        </div>
      </section>

      <section aria-labelledby="kinds-heading">
        <h2 id="kinds-heading" className="text-2xl font-bold">
          {t("kinds.heading")}
        </h2>
        <ul className="border-hairline mt-3 grid border-t sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {CASE_KINDS.map((k) => (
            <li key={k} className="border-hairline border-b">
              <Link
                href={`/admin/cases?kind=${k}`}
                className="hover:bg-accent flex min-h-12 items-baseline justify-between gap-4 px-1 py-2 no-underline"
              >
                <span className="text-foreground font-semibold underline decoration-1 underline-offset-4">
                  {tl(`kindPlural.${k}`)}
                </span>
                <span className="text-foreground tabular-nums">
                  <span className="text-xl font-bold">
                    {s.perKind[k].open}
                  </span>{" "}
                  <span className="text-muted-foreground text-sm">
                    {t("kinds.open")} · {s.perKind[k].total} {t("kinds.all")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-2xl font-bold">
          {t("week.heading", { count: s.week.total })}
        </h2>
        {s.week.total === 0 ? (
          <p className="text-muted-foreground mt-2">{t("week.none")}</p>
        ) : (
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">{t("week.byKind")}</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {kinds.map((k) => (
                  <li key={k} className="flex justify-between gap-4">
                    <Link href={`/admin/cases?kind=${k}`}>
                      {L.caseKind[k]}
                    </Link>
                    <span className="font-semibold tabular-nums">
                      {s.week.byKind[k]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">{t("week.byArea")}</h3>
              {areas.length === 0 ? (
                <p className="text-muted-foreground mt-2">
                  {t("week.areasLater")}
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {areas.map((a) => (
                    <li key={a} className="flex justify-between gap-4">
                      <Link href={`/admin/cases?area=${a}`}>{L.area[a]}</Link>
                      <span className="font-semibold tabular-nums">
                        {s.week.byArea[a]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="latest-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="latest-heading" className="text-2xl font-bold">
            {t("latest.heading")}
          </h2>
          <Link
            href="/admin/cases"
            className="inline-flex min-h-12 items-center gap-1 font-semibold"
          >
            {t("latest.toInbox")}
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Link>
        </div>
        {s.latest.length === 0 ? (
          <p className="text-muted-foreground mt-2">{t("latest.empty")}</p>
        ) : (
          <ul className="border-hairline mt-3 border-t">
            {s.latest.map((c) => (
              <li
                key={c.code}
                className="border-hairline flex flex-col gap-1 border-b py-3"
              >
                <p className="flex flex-wrap items-center gap-x-1 text-sm">
                  <span className="font-mono font-semibold">{c.code}</span> ·{" "}
                  {L.caseKind[c.kind]} · {L.caseStatus[c.status]} ·{" "}
                  {relativeAge(c.createdAt, tt)}
                  {c.urgency === "high" && (
                    <span className="text-destructive font-bold">
                      {" "}
                      · {tl("urgent")}
                    </span>
                  )}
                  {c.isSample && <SampleBadge className="ml-1" />}
                </p>
                <Link
                  href={`/admin/cases/${c.code}`}
                  className="font-semibold break-words"
                >
                  {c.title}
                </Link>
                {c.summary && (
                  <p
                    className="text-muted-foreground"
                    lang={
                      c.summaryLang && c.summaryLang !== locale
                        ? c.summaryLang
                        : undefined
                    }
                  >
                    {c.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <WhiteSpotsTeaser />
    </div>
  );
}

/** Top 3 unmet needs (area × powiat) of the last 30 days, from Trendy. */
function WhiteSpotsTeaser() {
  const t = useTranslations("admin.pulpit.gaps");
  const q = api.admin.trends.whiteSpots.useQuery(
    { days: 30 },
    { refetchInterval: 60_000 },
  );
  const top = q.data?.slice(0, 3) ?? [];
  return (
    <section aria-labelledby="gaps-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gaps-heading" className="text-2xl font-bold">
          {t("heading")}
        </h2>
        <Link
          href="/admin/trends"
          className="inline-flex min-h-12 items-center gap-1 font-semibold"
        >
          {t("link")}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <p className="mt-1 max-w-prose">{t("lead")}</p>
      {q.isPending ? (
        <p role="status" className="mt-3">
          {t("loading")}
        </p>
      ) : q.error ? (
        <p role="alert" className="mt-3">
          {t("error")}
        </p>
      ) : top.length === 0 ? (
        <p className="text-muted-foreground mt-3">{t("empty")}</p>
      ) : (
        <ol className="border-hairline mt-3 border-t">
          {top.map((w) => (
            <li
              key={`${w.area}-${w.powiat ?? ""}`}
              className="border-hairline border-b py-3"
            >
              <p className="flex flex-wrap items-center gap-2">
                <Link
                  href={
                    w.area === "none"
                      ? "/admin/trends"
                      : `/admin/trends?area=${w.area}`
                  }
                  className="font-semibold"
                >
                  {w.areaLabel} · {w.powiatName}
                </Link>
                <span className="tabular-nums">
                  {t("count", { count: w.count })}
                </span>
                {w.sample && <SampleBadge />}
              </p>
              {w.examples[0] && (
                <p className="text-muted-foreground mt-1">„{w.examples[0]}”</p>
              )}
            </li>
          ))}
        </ol>
      )}
      <SourceLine
        className="mt-3"
        source={t("source")}
        detail={t("sourceDetail")}
        date={new Date()}
      />
    </section>
  );
}
