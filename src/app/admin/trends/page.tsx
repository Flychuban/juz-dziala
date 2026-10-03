import { type Metadata } from "next";
import { DownloadIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { CallTopicButton } from "~/components/admin/call-topic-button";
import {
  countPl,
  EmptyState,
  formatDatePl,
  SampleBadge,
  SourceLine,
} from "~/components/kit";
import { PowiatMap } from "~/components/map";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { MAPA_AREA_LABEL, MAPA_AREAS, mapaAreaSchema } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { TREND_DAYS } from "~/server/admin/trends";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Trendy i białe plamy" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const SELECT =
  "border-input bg-background text-foreground min-h-12 w-full rounded-md border-2 px-3 text-base";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const areaParsed = mapaAreaSchema.safeParse(one(sp.area));
  const area = areaParsed.success ? areaParsed.data : null;
  const daysRaw = Number(one(sp.days) || 30);
  const days = (
    (TREND_DAYS as readonly number[]).includes(daysRaw) ? daysRaw : 30
  ) as 7 | 30 | 90;

  const [overview, spots] = await Promise.all([
    api.admin.trends.overview({ area, days }),
    api.admin.trends.whiteSpots({ area, days }),
  ]);
  const maxArea = Math.max(1, ...overview.byArea.map((a) => a.count));
  const allSample = overview.total > 0 && overview.sample === overview.total;
  const scope = `${area ? MAPA_AREA_LABEL[area] : "wszystkie obszary"}, ostatnie ${days} dni`;
  const csvHref = `/admin/trends/export?days=${days}${area ? `&area=${area}` : ""}`;
  const source = (
    <SourceLine
      source="Opisy potrzeb w serwisie Już Działa (zanonimizowane) i sprawy typu „Potrzeba”"
      date={new Date()}
    />
  );

  return (
    <>
      <AdminHeader
        title="Trendy i białe plamy"
        lead={
          <p>
            Z czym mieszkańcy przychodzą do serwisu — według obszaru Mapy
            Wyzwań, powiatu i tygodnia. „Białe plamy” to potrzeby, na które
            Biblioteka nie ma pewnej odpowiedzi. Widoczne tylko dla zespołu
            ROPS.
          </p>
        }
      >
        <form
          method="get"
          action="/admin/trends"
          className="grid grid-cols-1 max-w-3xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <label htmlFor="t-area" className="block font-semibold">
              Obszar
            </label>
            <select
              id="t-area"
              name="area"
              defaultValue={area ?? ""}
              className={cn(SELECT, "mt-2")}
            >
              <option value="">Wszystkie obszary</option>
              {MAPA_AREAS.map((a) => (
                <option key={a} value={a}>
                  {MAPA_AREA_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="t-days" className="block font-semibold">
              Okres
            </label>
            <select
              id="t-days"
              name="days"
              defaultValue={String(days)}
              className={cn(SELECT, "mt-2")}
            >
              {TREND_DAYS.map((d) => (
                <option key={d} value={d}>
                  Ostatnie {d} dni
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Pokaż</Button>
        </form>
      </AdminHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="totals-heading">
          <h2 id="totals-heading" className="sr-only">
            Podsumowanie
          </h2>
          {allSample ? (
            <p className="mb-6 flex flex-wrap items-center gap-2">
              <SampleBadge label="dane przykładowe" />
              Wszystkie potrzeby w tym widoku to dane przykładowe, do pokazania
              działania panelu.
            </p>
          ) : overview.sample > 0 ? (
            <p className="mb-6 flex flex-wrap items-center gap-2">
              <SampleBadge />W tym {overview.sample} przykładowych.
            </p>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
            {[
              { label: "Opisane potrzeby", value: overview.total },
              {
                label: "Bez pewnego dopasowania (białe plamy)",
                value: overview.unmet,
              },
              { label: "Z podanym powiatem", value: overview.withPowiat },
            ].map((s) => (
              <div key={s.label} className="border-hairline border-t-2 pt-4">
                <dt className="text-base">{s.label}</dt>
                <dd className="font-display tabular mt-1 text-5xl font-bold">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-4 text-sm">Zakres: {scope}.</p>
        </section>

        {overview.total === 0 ? (
          <EmptyState
            title="Brak potrzeb w tym okresie"
            description={<p>Wybierz dłuższy okres albo inny obszar.</p>}
          />
        ) : (
          <>
            <section aria-labelledby="map-heading">
              <h2
                id="map-heading"
                className="font-display text-2xl font-bold md:text-3xl"
              >
                Potrzeby według powiatu
              </h2>
              <p className="text-foreground/85 mt-2 max-w-[68ch]">
                Liczba opisanych potrzeb w każdym z 22 powiatów ({scope}). Obok
                mapy jest tabela z tymi samymi liczbami.
              </p>
              <div className="mt-6">
                <PowiatMap
                  values={overview.byPowiat}
                  label={`Opisane potrzeby według powiatu — ${scope}`}
                  valueLabel="Potrzeby"
                  source={source}
                />
              </div>
            </section>

            <section aria-labelledby="areas-heading">
              <h2
                id="areas-heading"
                className="font-display text-2xl font-bold md:text-3xl"
              >
                Potrzeby według obszaru
              </h2>
              <p className="text-foreground/85 mt-2 max-w-[68ch]">
                Jedna potrzeba może dotyczyć kilku obszarów. Ciemniejsza część
                paska to potrzeby bez dopasowania.
              </p>
              <ul className="mt-6 max-w-4xl space-y-4">
                {overview.byArea.map((a) => (
                  <li
                    key={a.area}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center"
                  >
                    <span className="font-semibold">{a.label}</span>
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-surface border-hairline flex h-6 flex-1 overflow-hidden rounded-sm border"
                      >
                        <span
                          className="bg-primary h-full"
                          style={{
                            width: `${((a.count - a.unmet) / maxArea) * 100}%`,
                          }}
                        />
                        <span
                          className="bg-foreground h-full border-l-2 border-[var(--background)]"
                          style={{ width: `${(a.unmet / maxArea) * 100}%` }}
                        />
                      </span>
                      <span className="tabular w-40 shrink-0 text-[0.9375rem] sm:w-72">
                        <span className="font-bold">{a.count}</span>
                        {a.unmet ? `, w tym ${a.unmet} bez dopasowania` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p
                className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm"
                aria-hidden="true"
              >
                <span className="flex items-center gap-2">
                  <span className="bg-primary inline-block size-4 rounded-sm" />{" "}
                  z dopasowaniem
                </span>
                <span className="flex items-center gap-2">
                  <span className="bg-foreground inline-block size-4 rounded-sm" />{" "}
                  bez dopasowania
                </span>
              </p>
            </section>

            <section aria-labelledby="weeks-heading">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2
                  id="weeks-heading"
                  className="font-display text-2xl font-bold md:text-3xl"
                >
                  Tydzień po tygodniu
                </h2>
                <Button asChild variant="secondary">
                  <a href={csvHref} download>
                    <DownloadIcon aria-hidden="true" />
                    Pobierz CSV (tydzień × obszar × powiat)
                  </a>
                </Button>
              </div>
              <div className="mt-6 max-w-2xl">
                <Table>
                  <TableCaption>
                    Opisane potrzeby w kolejnych tygodniach — {scope}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tydzień od</TableHead>
                      <TableHead className="text-right">Potrzeby</TableHead>
                      <TableHead className="text-right">
                        Bez dopasowania
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.byWeek.map((w) => (
                      <TableRow key={w.week}>
                        <TableCell>{formatDatePl(w.week)}</TableCell>
                        <TableCell className="text-right">{w.count}</TableCell>
                        <TableCell className="text-right">{w.unmet}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}

        <section
          aria-labelledby="spots-heading"
          className="border-hairline border-t pt-10"
        >
          <h2
            id="spots-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            Białe plamy
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            Potrzeby, przy których serwis nie znalazł pewnego rozwiązania w
            Bibliotece — pogrupowane według obszaru i powiatu. Przykładowe opisy
            są zanonimizowane. Dla każdej grupy możesz poprosić asystenta AI o
            szkic tematu naboru.
          </p>
          {spots.length === 0 ? (
            <p className="mt-6 font-semibold">
              W tym okresie każda potrzeba miała dopasowanie.
            </p>
          ) : (
            <ol className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {spots.slice(0, 12).map((s) => (
                <li
                  key={`${s.area}-${s.powiat}`}
                  className="border-hairline rounded-lg border p-5"
                >
                  <h3 className="font-display text-xl font-bold">
                    {s.areaLabel} · {s.powiatName}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="tabular font-semibold">
                      {countPl(s.count, "potrzeba", "potrzeby", "potrzeb")} bez
                      dopasowania
                    </span>
                    {s.sample ? <SampleBadge /> : null}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {s.examples.map((e) => (
                      <li key={e}>
                        <blockquote className="border-input text-foreground/90 border-l-4 pl-3">
                          „{e}”
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                  <CallTopicButton
                    area={s.area}
                    powiat={s.powiat}
                    days={days}
                    label={`${s.areaLabel}, ${s.powiatName}`}
                  />
                </li>
              ))}
            </ol>
          )}
          {spots.length > 12 ? (
            <p className="mt-4 text-[0.9375rem]">
              Pokazujemy 12 największych grup z {spots.length}. Pełne dane są w
              pliku CSV.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
