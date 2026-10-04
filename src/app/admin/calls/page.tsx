import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { EmptyState, formatDate } from "~/components/kit";
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
import { labelsFor } from "~/lib/domain";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.calls");
  return { title: t("metaTitle") };
}

export default async function AdminCallsPage() {
  const [rows, subscribers, deliveries, t, locale] = await Promise.all([
    api.admin.calls.list(),
    api.admin.calls.subscribers(),
    api.admin.calls.deliveries(),
    getTranslations("admin.calls"),
    getLocale(),
  ]);
  const L = labelsFor(locale);
  const PLN = new Intl.NumberFormat(locale === "en" ? "en-GB" : "pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  });
  // Calls are written in Polish; English UI shows them as Polish text.
  const pl = locale === "en" ? "pl" : undefined;
  const areaSubs = Object.entries(subscribers)
    .filter(([t]) => t.startsWith("area:"))
    .reduce((n, [, c]) => n + c, 0);

  return (
    <>
      <AdminHeader title={t("title")} lead={<p>{t("lead")}</p>}>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link href="/admin/calls/new">
              <PlusIcon aria-hidden="true" />
              {t("new")}
            </Link>
          </Button>
          <p className="tabular text-[0.9375rem]">
            {t("subscriptions", {
              calls: subscribers.calls ?? 0,
              areas: areaSubs,
            })}
          </p>
        </div>
      </AdminHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {rows.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={<p>{t("emptyBody")}</p>}
          />
        ) : (
          <Table>
            <TableCaption>{t("caption", { count: rows.length })}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colCall")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colWindow")}</TableHead>
                <TableHead className="text-right">{t("colAmount")}</TableHead>
                <TableHead>{t("colAreas")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="min-w-72">
                    <Link
                      href={`/admin/calls/${c.id}`}
                      className="font-semibold underline decoration-1 underline-offset-4"
                      lang={pl}
                    >
                      {c.name}
                    </Link>
                    {c.program ? (
                      <span
                        className="text-muted-foreground block text-sm"
                        lang={pl}
                      >
                        {c.program}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {L.callStatus[c.status]}
                  </TableCell>
                  <TableCell className="text-[0.9375rem] whitespace-nowrap">
                    {c.windowFrom ? formatDate(c.windowFrom, locale) : "—"}
                    <br />
                    {c.windowTo
                      ? t("until", { date: formatDate(c.windowTo, locale) })
                      : ""}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {c.amountMax ? PLN.format(c.amountMax) : "—"}
                  </TableCell>
                  <TableCell className="text-[0.9375rem]">
                    {c.areas.length
                      ? c.areas.map((a) => L.area[a]).join(", ")
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
            {t("deliveriesHeading")}
          </h2>
          {deliveries.length ? (
            <div className="mt-4">
              <Table>
                <TableCaption className="sr-only">
                  {t("deliveriesCaption")}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colWhen")}</TableHead>
                    <TableHead>{t("colSubject")}</TableHead>
                    <TableHead>{t("colChannel")}</TableHead>
                    <TableHead>{t("colResult")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(d.createdAt, locale)}
                      </TableCell>
                      <TableCell lang={pl}>{d.subject}</TableCell>
                      <TableCell className="tabular">
                        {d.channel === "sms" ? t("sms") : t("email")} ·{" "}
                        {d.toMasked}
                      </TableCell>
                      <TableCell>
                        {t(`delivery.${d.status}`)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-foreground/85 mt-3">{t("noDeliveries")}</p>
          )}
        </section>
      </div>
    </>
  );
}
