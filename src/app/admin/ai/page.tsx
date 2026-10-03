import { type Metadata } from "next";

import { AdminHeader } from "~/components/admin/admin-header";
import { EmptyState, formatDatePl } from "~/components/kit";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "AI: koszty i jakość" };

const INT = new Intl.NumberFormat("pl-PL");
const SEC = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat("pl-PL", {
  style: "percent",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

/** Readable names for the AI functions (fn column); unknown ones show their code. */
const FN_LABEL: Record<string, string> = {
  "admin.cardFromDocument": "Karta z dokumentu",
  "admin.proposeCallTopic": "Temat naboru z białych plam",
};

const rate = (r?: { rate?: number | null; count?: number; total?: number }) =>
  r && typeof r.rate === "number"
    ? `${PCT.format(r.rate)} (${r.count ?? 0}/${r.total ?? 0})`
    : "—";

export default async function AdminAiPage() {
  const { byFn, totals, evals } = await api.admin.ai.summary();

  return (
    <>
      <AdminHeader
        title="AI: koszty i jakość"
        lead={
          <p>
            Każde wywołanie modelu Claude jest zapisywane z liczbą tokenów,
            czasem odpowiedzi i kosztem. Te liczby są podstawą szacunku kosztów
            utrzymania serwisu.
          </p>
        }
      />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="usage-heading">
          <h2
            id="usage-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            Wywołania według funkcji
          </h2>
          {byFn.length === 0 ? (
            <EmptyState
              className="mt-6"
              headingLevel="h3"
              title="Brak wywołań AI"
              description={
                <p>
                  Nie zapisano jeszcze żadnego wywołania. Tabela wypełni się po
                  pierwszym dopasowaniu, triażu sprawy lub szkicu dokumentu.
                </p>
              }
            />
          ) : (
            <div className="mt-6">
              <Table>
                <TableCaption>
                  Wywołania AI od początku działania serwisu (koszt w USD według
                  cennika modelu)
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funkcja</TableHead>
                    <TableHead className="text-right">Wywołania</TableHead>
                    <TableHead className="text-right">Śr. czas</TableHead>
                    <TableHead className="text-right">p95</TableHead>
                    <TableHead className="text-right">
                      Tokeny wej./wyj.
                    </TableHead>
                    <TableHead className="text-right">
                      Z pamięci podręcznej
                    </TableHead>
                    <TableHead className="text-right">Koszt łącznie</TableHead>
                    <TableHead className="text-right">Śr. koszt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byFn.map((r) => (
                    <TableRow key={r.fn}>
                      <TableCell>
                        <span className="font-semibold">
                          {FN_LABEL[r.fn] ?? r.fn}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {r.fn}
                          {r.failed ? ` · nieudane: ${r.failed}` : ""}
                          {r.lastAt
                            ? ` · ostatnio ${formatDatePl(r.lastAt)}`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {INT.format(r.calls)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {SEC.format(r.avgLatencyMs / 1000)} s
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {SEC.format(r.p95LatencyMs / 1000)} s
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {INT.format(r.inputTokens)} /{" "}
                        {INT.format(r.outputTokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {PCT.format(r.cacheReadPct)}
                      </TableCell>
                      <TableCell className="text-right">
                        {USD.format(r.totalCostUsd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {USD.format(r.avgCostUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Razem</TableCell>
                    <TableCell className="text-right">
                      {INT.format(totals.calls)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right whitespace-nowrap">
                      {INT.format(totals.inputTokens)} /{" "}
                      {INT.format(totals.outputTokens)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      {USD.format(totals.costUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {totals.calls
                        ? USD.format(totals.costUsd / totals.calls)
                        : "—"}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </section>

        <section aria-labelledby="eval-heading">
          <h2
            id="eval-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            Jakość dopasowania — ostatnia ewaluacja
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            Zamrożony zestaw 20 opisów problemów (w tym próby wstrzyknięcia
            poleceń i dane osobowe do usunięcia). Najnowszy wynik dla każdej
            metody dopasowania.
          </p>
          {evals.length === 0 ? (
            <p className="mt-4 font-semibold">
              Brak wyników ewaluacji (eval/results).
            </p>
          ) : (
            <div className="mt-6">
              <Table>
                <TableCaption>Wyniki z katalogu eval/results</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metoda</TableHead>
                    <TableHead className="text-right">
                      Trafienie w top 3
                    </TableHead>
                    <TableHead className="text-right">
                      Najlepsze na 1. miejscu
                    </TableHead>
                    <TableHead className="text-right">
                      Słuszne „nie wiem”
                    </TableHead>
                    <TableHead className="text-right">Wycieki danych</TableHead>
                    <TableHead className="text-right">
                      Wykonane wstrzyknięcia
                    </TableHead>
                    <TableHead className="text-right">Czas p50 / p95</TableHead>
                    <TableHead className="text-right">Śr. koszt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evals.map((e) => (
                    <TableRow key={e.file}>
                      <TableCell>
                        <span className="font-semibold">
                          {e.matcher === "keyword"
                            ? "Słowa kluczowe (bez AI)"
                            : e.matcher === "ai"
                              ? "AI + weryfikacja"
                              : e.matcher}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {formatDatePl(e.startedAt)} · przypadki:{" "}
                          {e.summary.cases ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {rate(e.summary.hit3)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {rate(e.summary.top1)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {rate(e.summary.abstainOnExpected)}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.summary.piiLeaks ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.summary.injectionsFollowed ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {e.summary.latencyMs?.p50 !== undefined
                          ? `${SEC.format((e.summary.latencyMs.p50 ?? 0) / 1000)} / ${SEC.format((e.summary.latencyMs.p95 ?? 0) / 1000)} s`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.summary.costUsd?.mean !== undefined
                          ? USD.format(e.summary.costUsd.mean)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <p className="border-hairline bg-surface max-w-[68ch] rounded-md border p-4">
          Te tabele są podstawą szacunku kosztów utrzymania: średni koszt
          wywołania razy spodziewana liczba spraw miesięcznie. Ceny modelu: 4
          USD za milion tokenów wejściowych i 20 USD za milion wyjściowych;
          odczyt z pamięci podręcznej 0,20 USD.
        </p>
      </div>
    </>
  );
}
