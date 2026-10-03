import { type Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { EmptyState, formatDatePl } from "~/components/kit";
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
import { CALL_STATUS_LABEL, MAPA_AREA_LABEL } from "~/lib/domain";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Nabory — edycja" };

const PLN = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const DELIVERY_STATUS: Record<string, string> = {
  sent: "wysłano",
  simulated: "SMS — symulacja",
  skipped: "pominięto (brak poczty)",
  failed: "błąd",
};

export default async function AdminCallsPage() {
  const [rows, subscribers, deliveries] = await Promise.all([
    api.admin.calls.list(),
    api.admin.calls.subscribers(),
    api.admin.calls.deliveries(),
  ]);
  const areaSubs = Object.entries(subscribers)
    .filter(([t]) => t.startsWith("area:"))
    .reduce((n, [, c]) => n + c, 0);

  return (
    <>
      <AdminHeader
        title="Nabory"
        lead={
          <p>
            Nabory na innowacje społeczne. Zapisana zmiana jest od razu widoczna
            w serwisie i w otwartym API. „Opublikuj zmiany” dodatkowo powiadamia
            osoby, które zapisały się na nabory lub na obszar naboru.
          </p>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link href="/admin/calls/new">
              <PlusIcon aria-hidden="true" />
              Nowy nabór
            </Link>
          </Button>
          <p className="tabular text-[0.9375rem]">
            Subskrypcje: nabory — {subscribers.calls ?? 0}, obszary — {areaSubs}
          </p>
        </div>
      </AdminHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {rows.length === 0 ? (
          <EmptyState
            title="Brak naborów"
            description={<p>Dodaj pierwszy nabór.</p>}
          />
        ) : (
          <Table>
            <TableCaption>Nabory ({rows.length})</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nabór</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead className="text-right">Maks. kwota</TableHead>
                <TableHead>Obszary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="min-w-72">
                    <Link
                      href={`/admin/calls/${c.id}`}
                      className="font-semibold underline decoration-1 underline-offset-4"
                    >
                      {c.name}
                    </Link>
                    {c.program ? (
                      <span className="text-muted-foreground block text-sm">
                        {c.program}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {CALL_STATUS_LABEL[c.status]}
                  </TableCell>
                  <TableCell className="text-[0.9375rem] whitespace-nowrap">
                    {c.windowFrom ? formatDatePl(c.windowFrom) : "—"}
                    <br />
                    {c.windowTo ? `do ${formatDatePl(c.windowTo)}` : ""}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {c.amountMax ? PLN.format(c.amountMax) : "—"}
                  </TableCell>
                  <TableCell className="text-[0.9375rem]">
                    {c.areas.length
                      ? c.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <section
          aria-labelledby="deliveries-heading"
          className="border-hairline mt-14 border-t pt-8"
        >
          <h2
            id="deliveries-heading"
            className="font-display text-2xl font-bold"
          >
            Ostatnie powiadomienia o naborach
          </h2>
          {deliveries.length ? (
            <div className="mt-4">
              <Table>
                <TableCaption className="sr-only">
                  Ostatnie powiadomienia
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kiedy</TableHead>
                    <TableHead>Temat</TableHead>
                    <TableHead>Kanał i odbiorca</TableHead>
                    <TableHead>Wynik</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDatePl(d.createdAt)}
                      </TableCell>
                      <TableCell>{d.subject}</TableCell>
                      <TableCell className="tabular">
                        {d.channel === "sms" ? "SMS" : "E-mail"} · {d.toMasked}
                      </TableCell>
                      <TableCell>
                        {DELIVERY_STATUS[d.status] ?? d.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-foreground/85 mt-3">
              Jeszcze nikogo nie powiadomiono.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
