import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FileUpIcon, SearchIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { StatusBadge } from "~/components/admin/status-badge";
import { EmptyState, formatDate } from "~/components/kit";
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
  labelsFor,
  type InnovationStatus,
} from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.library");
  return { title: t("metaTitle") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("admin.library"),
    getLocale(),
  ]);
  const L = labelsFor(locale);
  // Cards are edited in Polish (the Library's source language).
  const pl = locale === "en" ? "pl" : undefined;
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
        title={t("title")}
        lead={
          <>
            <p>{t("lead")}</p>
            {locale === "en" ? <p className="mt-2">{t("englishNote")}</p> : null}
          </>
        }
      >
        <Button asChild size="lg">
          <Link href="/admin/library/new">
            <FileUpIcon aria-hidden="true" />
            {t("fromDocument")}
          </Link>
        </Button>
      </AdminHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <form
          method="get"
          action="/admin/library"
          role="search"
          aria-label={t("searchForm")}
          className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="q" className="block font-semibold">
              {t("searchLabel")}
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
            {t("search")}
          </Button>
        </form>

        <nav aria-label={t("statusFilter")} className="mt-6">
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
                    {s ? L.innovationStatus[s] : t("all")}
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
          {t("count", { count: rows.length })}
          {q ? (
            <span className="font-normal"> {t("countFor", { q })}</span>
          ) : null}
        </p>

        {rows.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={t("emptyTitle")}
            description={<p>{t("emptyBody")}</p>}
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/library">{t("showAll")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-4">
            <Table>
              <TableCaption className="sr-only">
                {t("caption")}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colCard")}</TableHead>
                  <TableHead>{t("colAreas")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colChanged")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t("colActions")}</span>
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
                        lang={pl}
                      >
                        {r.title}
                      </Link>
                      <span className="text-muted-foreground block text-sm">
                        {r.id}
                        {r.testingOpen ? ` · ${t("openForTesters")}` : ""}
                        {r.videoUrl ? ` · ${t("film")}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-40 text-[0.9375rem]">
                      {r.mapaAreas.length
                        ? r.mapaAreas.map((a) => L.area[a]).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-[0.9375rem] whitespace-nowrap">
                      {formatDate(r.updatedAt, locale)}
                      {r.updatedBy ? (
                        <span className="text-muted-foreground block text-sm">
                          {r.updatedBy.startsWith("rops")
                            ? t("byTeam")
                            : r.updatedBy}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/admin/library/${r.slug}/edit`}
                        className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
                      >
                        {t("edit")}
                        <span className="sr-only">: {r.title}</span>
                      </Link>
                      {r.status === "published" ? (
                        <Link
                          href={`/library/${r.slug}`}
                          className="ml-4 inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                        >
                          {t("view")}
                          <span className="sr-only">: {r.title}</span>
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
