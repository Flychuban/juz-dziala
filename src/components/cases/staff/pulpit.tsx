"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import {
  CASE_KIND_LABEL,
  CASE_KINDS,
  CASE_STATUS_LABEL,
  MAPA_AREA_LABEL,
  MAPA_AREAS,
  type CaseKind,
} from "~/lib/domain";
import { SampleBadge, SourceLine } from "~/components/kit";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ageLabel, plural } from "../format";
import { KIND_PLURAL } from "./labels";

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
  const q = api.admin.inbox.stats.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  if (q.isPending) return <p role="status">Wczytuję pulpit…</p>;
  if (q.error)
    return <p role="alert">Nie udało się wczytać pulpitu: {q.error.message}</p>;
  const s = q.data;
  const kinds = CASE_KINDS.filter((k) => s.week.byKind[k] > 0);
  const areas = MAPA_AREAS.filter((a) => s.week.byArea[a] > 0).sort(
    (a, b) => s.week.byArea[b] - s.week.byArea[a],
  );

  return (
    <div className="flex flex-col gap-10 [overflow-wrap:anywhere]">
      <section aria-labelledby="counters-heading">
        <h2 id="counters-heading" className="sr-only">
          Liczniki
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Counter
            label="Nowe"
            value={s.newCount}
            href="/admin/cases?status=new"
            hint="Jeszcze nikt ich nie podjął."
          />
          <Counter
            label="Czekają ponad 48 h"
            value={s.waitingOver48h}
            href="/admin/cases?waiting=1"
            hint="Otwarte, bez ruchu od 2 dni."
            alert
          />
          <Counter
            label="Otwarte"
            value={s.openCount}
            href="/admin/cases"
            hint="Nowe, ocenione i w toku."
          />
          <Counter
            label="Nieprzeczytane powiadomienia"
            value={s.unreadNotifications}
            href="/admin/cases"
            hint="Nowe sprawy i wiadomości od autorów."
          />
        </div>
      </section>

      <section aria-labelledby="kinds-heading">
        <h2 id="kinds-heading" className="text-2xl font-bold">
          Sprawy według rodzaju
        </h2>
        <p className="text-muted-foreground mt-1">
          Duża liczba: otwarte (nowe, ocenione, w toku). Pod nią: wszystkie.
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PULPIT_KINDS.map((k) => (
            <li key={k}>
              <Counter
                label={KIND_PLURAL[k]}
                value={s.perKind[k].open}
                href={`/admin/cases?kind=${k}`}
                hint={`Wszystkich: ${s.perKind[k].total}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-2xl font-bold">
          Ostatnie 7 dni: {s.week.total}{" "}
          {plural(s.week.total, ["sprawa", "sprawy", "spraw"])}
        </h2>
        {s.week.total === 0 ? (
          <p className="text-muted-foreground mt-2">Brak nowych spraw.</p>
        ) : (
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">Według rodzaju</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {kinds.map((k) => (
                  <li key={k} className="flex justify-between gap-4">
                    <Link href={`/admin/cases?kind=${k}`}>
                      {CASE_KIND_LABEL[k]}
                    </Link>
                    <span className="font-semibold tabular-nums">
                      {s.week.byKind[k]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">
                Według obszaru Mapy Wyzwań Społecznych
              </h3>
              {areas.length === 0 ? (
                <p className="text-muted-foreground mt-2">
                  Obszary pojawią się po wstępnej ocenie.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {areas.map((a) => (
                    <li key={a} className="flex justify-between gap-4">
                      <Link href={`/admin/cases?area=${a}`}>
                        {MAPA_AREA_LABEL[a]}
                      </Link>
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
            Najnowsze sprawy
          </h2>
          <Link
            href="/admin/cases"
            className="inline-flex min-h-12 items-center gap-1 font-semibold"
          >
            Przejdź do skrzynki spraw
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Link>
        </div>
        {s.latest.length === 0 ? (
          <p className="text-muted-foreground mt-2">Skrzynka jest pusta.</p>
        ) : (
          <ul className="border-hairline mt-3 border-t">
            {s.latest.map((c) => (
              <li
                key={c.code}
                className="border-hairline flex flex-col gap-1 border-b py-3"
              >
                <p className="text-sm">
                  <span className="font-mono font-semibold">{c.code}</span> ·{" "}
                  {CASE_KIND_LABEL[c.kind]} · {CASE_STATUS_LABEL[c.status]} ·{" "}
                  {ageLabel(c.createdAt)}
                  {c.urgency === "high" && (
                    <span className="text-destructive font-bold"> · Pilne</span>
                  )}
                </p>
                <Link
                  href={`/admin/cases/${c.code}`}
                  className="font-semibold break-words"
                >
                  {c.title}
                </Link>
                {c.summary && (
                  <p className="text-muted-foreground">{c.summary}</p>
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

const PULPIT_KINDS = [
  "need",
  "idea",
  "question",
  "test",
  "feedback",
  "adapt",
] as const satisfies readonly CaseKind[];

/** Top 3 unmet needs (area × powiat) of the last 30 days, from Trendy. */
function WhiteSpotsTeaser() {
  const q = api.admin.trends.whiteSpots.useQuery(
    { days: 30 },
    { refetchInterval: 60_000 },
  );
  const top = q.data?.slice(0, 3) ?? [];
  return (
    <section
      aria-labelledby="gaps-heading"
      className="border-hairline bg-surface rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gaps-heading" className="text-2xl font-bold">
          Białe plamy
        </h2>
        <Link
          href="/admin/trends"
          className="inline-flex min-h-12 items-center gap-1 font-semibold"
        >
          Trendy i białe plamy
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <p className="mt-1">
        Potrzeby z ostatnich 30 dni, na które Biblioteka nie miała pewnej
        odpowiedzi — największe skupiska według obszaru i powiatu.
      </p>
      {q.isPending ? (
        <p role="status" className="mt-3">
          Wczytuję białe plamy…
        </p>
      ) : q.error ? (
        <p role="alert" className="mt-3">
          Nie udało się wczytać białych plam.
        </p>
      ) : top.length === 0 ? (
        <p className="text-muted-foreground mt-3">
          Brak niezaspokojonych potrzeb w ostatnich 30 dniach.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {top.map((w) => (
            <li
              key={`${w.area}-${w.powiat ?? ""}`}
              className="border-hairline bg-background rounded-md border p-3"
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
                  {w.count}{" "}
                  {plural(w.count, ["potrzeba", "potrzeby", "potrzeb"])}
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
        source="Opisy potrzeb w serwisie Już Działa (zanonimizowane)"
        detail="ostatnie 30 dni"
        date={new Date()}
      />
    </section>
  );
}
