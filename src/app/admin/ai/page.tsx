import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AdminHeader } from "~/components/admin/admin-header";
import { EmptyState, formatDate } from "~/components/kit";
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
import { INTL_LOCALE, isLocale } from "~/i18n/config";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.ai");
  return { title: t("metaTitle") };
}

/**
 * Every AI function id written to jd_ai_call (aiStructured/aiStream `fn`),
 * with a readable name in admin.json → ai.fn. An id not listed here is shown
 * as „Inne" with its code underneath.
 */
const FN_IDS = [
  "match",
  "cases.triage",
  "library.easyText",
  "ideas.assist",
  "ideas.sketch",
  "ideas.application",
  "adapt.plan",
  "admin.proposeCallTopic",
  "admin.cardFromDocument",
  "tests.summary",
  "i18n.translate",
] as const;
type FnId = (typeof FN_IDS)[number];
const isFnId = (fn: string): fn is FnId =>
  (FN_IDS as readonly string[]).includes(fn);

type Rate = { rate?: number | null; count?: number; total?: number };

export default async function AdminAiPage() {
  const [{ byFn, totals, evals }, t, locale] = await Promise.all([
    api.admin.ai.summary(),
    getTranslations("admin.ai"),
    getLocale(),
  ]);
  const intl = INTL_LOCALE[isLocale(locale) ? locale : "pl"];
  const INT = new Intl.NumberFormat(intl);
  const SEC = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 });
  const PCT = new Intl.NumberFormat(intl, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const USD = new Intl.NumberFormat(intl, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });
  const seconds = (ms: number) =>
    t("seconds", { value: SEC.format(ms / 1000) });
  const rate = (r?: Rate) =>
    r && typeof r.rate === "number"
      ? `${PCT.format(r.rate)} (${r.count ?? 0}/${r.total ?? 0})`
      : "—";
  const fnLabel = (fn: string) => (isFnId(fn) ? t(`fn.${fn}`) : t("fn.other"));
  /** Matcher ids of eval runs: keyword, ai, and their English runs (-en). */
  const methodLabel = (m: string) => {
    const english = m.endsWith("-en");
    const base = english ? m.slice(0, -3) : m;
    if (base !== "keyword" && base !== "ai") return m;
    const name = base === "keyword" ? t("methodKeyword") : t("methodAi");
    return english ? t("methodEnglish", { name }) : name;
  };

  return (
    <>
      <AdminHeader title={t("title")} lead={<p>{t("lead")}</p>} />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="usage-heading">
          <h2
            id="usage-heading"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            {t("usageHeading")}
          </h2>
          {byFn.length === 0 ? (
            <EmptyState
              className="mt-6"
              headingLevel="h3"
              title={t("emptyTitle")}
              description={<p>{t("emptyBody")}</p>}
            />
          ) : (
            <div className="mt-6">
              <Table>
                <TableCaption>{t("caption")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colFn")}</TableHead>
                    <TableHead className="text-right">
                      {t("colCalls")}
                    </TableHead>
                    <TableHead className="text-right">{t("colAvg")}</TableHead>
                    <TableHead className="text-right">{t("colP95")}</TableHead>
                    <TableHead className="text-right">
                      {t("colTokens")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colCache")}
                    </TableHead>
                    <TableHead className="text-right">{t("colCost")}</TableHead>
                    <TableHead className="text-right">
                      {t("colAvgCost")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byFn.map((r) => (
                    <TableRow key={r.fn}>
                      <TableCell>
                        <span className="font-semibold">{fnLabel(r.fn)}</span>
                        <span className="text-muted-foreground block text-sm">
                          <code>{r.fn}</code>
                          {r.failed
                            ? ` · ${t("failed", { count: r.failed })}`
                            : ""}
                          {r.lastAt
                            ? ` · ${t("last", { date: formatDate(r.lastAt, locale) })}`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {INT.format(r.calls)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {seconds(r.avgLatencyMs)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {seconds(r.p95LatencyMs)}
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
                    <TableCell>{t("total")}</TableCell>
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
            {t("evalHeading")}
          </h2>
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            {t("evalLead")}
          </p>
          {evals.length === 0 ? (
            <p className="mt-4 font-semibold">{t("evalNone")}</p>
          ) : (
            <div className="mt-6">
              <Table>
                <TableCaption>{t("evalCaption")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colMethod")}</TableHead>
                    <TableHead className="text-right">{t("colHit3")}</TableHead>
                    <TableHead className="text-right">{t("colTop1")}</TableHead>
                    <TableHead className="text-right">
                      {t("colAbstain")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colLeaks")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colInjections")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colLatency")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colAvgCost")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evals.map((e) => (
                    <TableRow key={e.file}>
                      <TableCell>
                        <span className="font-semibold">
                          {methodLabel(e.matcher)}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {formatDate(e.startedAt, locale)} ·{" "}
                          {t("cases", { count: e.summary.cases ?? "—" })}
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
                          ? `${SEC.format((e.summary.latencyMs.p50 ?? 0) / 1000)} / ${seconds(e.summary.latencyMs.p95 ?? 0)}`
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

        <p className="border-hairline max-w-[68ch] border-l-4 pl-4">
          {t("costNote")}
        </p>
      </div>
    </>
  );
}
