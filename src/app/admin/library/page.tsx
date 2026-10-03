import { type Metadata } from "next";
import Link from "next/link";
import { FileUpIcon, SearchIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { StatusBadge } from "~/components/admin/status-badge";
import { countPl, EmptyState, formatDatePl } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  INNOVATION_STATUS,
  INNOVATION_STATUS_LABEL,
  MAPA_AREA_LABEL,
  type InnovationStatus,
} from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Biblioteka — edycja" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 200);
  const statusRaw = one(sp.status);
  const status = (INNOVATION_STATUS as readonly string[]).includes(statusRaw)
    ? (statusRaw as InnovationStatus)
    : undefined;

  const [all, rows] = await Promise.all([
    api.admin.library.list(),
    api.admin.library.list({ q: q || undefined, status }),
  ]);
  const counts = Object.fromEntries(
    INNOVATION_STATUS.map((s) => [s, all.filter((r) => r.status === s).length]),
  ) as Record<InnovationStatus, number>;
  const href = (s?: InnovationStatus) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/admin/library?${qs}` : "/admin/library";
  };

  return (
    <>
      <AdminHeader
        title="Biblioteka — edycja"
        lead={
          <p>
            Wszystkie karty Biblioteki Innowacji Społecznych. Zapisana zmiana
            jest od razu widoczna na stronie i w dopasowaniu; każda trafia do
            dziennika zmian.
          </p>
        }
      >
        <Button asChild size="lg">
          <Link href="/admin/library/new">
            <FileUpIcon aria-hidden="true" />
            Dodaj z dokumentu
          </Link>
        </Button>
      </AdminHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <form
          method="get"
          action="/admin/library"
          role="search"
          aria-label="Szukaj kart"
          className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="q" className="block font-semibold">
              Szukaj po tytule, słowie kluczowym lub numerze karty
            </label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              className="mt-2"
            />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <Button type="submit">
            <SearchIcon aria-hidden="true" />
            Szukaj
          </Button>
        </form>

        <nav aria-label="Filtruj według statusu" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {[undefined, ...INNOVATION_STATUS].map((s) => {
              const active = s === status;
              return (
                <li key={s ?? "all"}>
                  <Link
                    href={href(s)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 font-semibold no-underline",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-surface",
                    )}
                  >
                    {s ? INNOVATION_STATUS_LABEL[s] : "Wszystkie"}
                    <span className="tabular font-normal">
                      {s ? counts[s] : all.length}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <p role="status" className="font-display mt-8 text-xl font-bold">
          {countPl(rows.length, "karta", "karty", "kart")}
          {q ? <span className="font-normal"> dla „{q}”</span> : null}
        </p>

        {rows.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Brak kart"
            description={<p>Zmień wyszukiwanie albo filtr statusu.</p>}
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/library">Pokaż wszystkie</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-4">
            <Table>
              <TableCaption className="sr-only">
                Karty Biblioteki i ich status
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Karta</TableHead>
                  <TableHead>Obszary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ostatnia zmiana</TableHead>
                  <TableHead>
                    <span className="sr-only">Akcje</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="min-w-64">
                      <Link
                        href={`/admin/library/${r.slug}/edit`}
                        className="font-semibold underline decoration-1 underline-offset-4"
                      >
                        {r.title}
                      </Link>
                      <span className="text-muted-foreground block text-sm">
                        {r.id}
                        {r.testingOpen ? " · otwarta dla testerów" : ""}
                        {r.videoUrl ? " · film" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-40 text-[0.9375rem]">
                      {r.mapaAreas.length
                        ? r.mapaAreas.map((a) => MAPA_AREA_LABEL[a]).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-[0.9375rem] whitespace-nowrap">
                      {formatDatePl(r.updatedAt)}
                      {r.updatedBy ? (
                        <span className="text-muted-foreground block text-sm">
                          {r.updatedBy.startsWith("rops")
                            ? "zespół ROPS"
                            : r.updatedBy}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/admin/library/${r.slug}/edit`}
                        className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
                      >
                        Edytuj<span className="sr-only">: {r.title}</span>
                      </Link>
                      {r.status === "published" ? (
                        <Link
                          href={`/library/${r.slug}`}
                          className="ml-4 inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                        >
                          Zobacz<span className="sr-only">: {r.title}</span>
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
