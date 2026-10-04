import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanMarkdown } from "~/components/adapt/plan-markdown";
import { fmtDate } from "~/components/cases/format";
import { PrintButton } from "~/components/cases/print-button";
import { labelsFor } from "~/lib/domain";
import { caseForPage } from "~/server/cases/access";
import { casePayloads } from "~/server/cases/payloads";
import { normalizeCaseCode } from "~/server/domain/case-code";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cases.meta");
  return { title: t("plan") };
}

/**
 * The full Ramowy Plan Wdrożenia of an „adapt" case, laid out for A4. A wrong
 * code counts as a guess, as on the case page.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const typed = decodeURIComponent((await params).code);
  const code = normalizeCaseCode(typed);
  if (!code) notFound();
  if (code !== typed) redirect(`/case/${code}/plan`);
  const found = await caseForPage(code);
  const t = await getTranslations("cases");
  if (!found.ok) {
    if (found.status === "NOT_FOUND") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{t("view.cannotOpen")}</h1>
        <p role="alert" className="mt-3 text-lg">
          {found.message}
        </p>
      </div>
    );
  }
  const c = found.case;
  if (c.kind !== "adapt") notFound();
  const locale = await getLocale();
  const { plan } = await casePayloads(c, { staff: false, locale });
  if (!plan) notFound();
  const tm = await getTranslations("cases.modules");
  const site = labelsFor(locale).site;
  // The plan is a document in its own language; mark it when the page differs.
  const planLang = plan.locale !== locale ? plan.locale : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 [overflow-wrap:anywhere] print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 16mm; }"}</style>
      <div className="mb-6 flex flex-wrap items-center gap-3" data-no-print>
        <PrintButton label={tm("plan.print")} />
        <Link
          href={`/case/${c.code}`}
          className="inline-flex min-h-12 items-center px-2 underline"
        >
          {t("print.back")}
        </Link>
      </div>
      <p className="text-muted-foreground font-semibold print:text-black">
        {site.name} · {site.hub} · {t("plan.case")}{" "}
        <span className="font-mono">{c.code}</span>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{tm("plan.heading")}</h1>
      <dl className="mt-4 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr] print:grid-cols-[auto_1fr]">
        {plan.details.map((d) => (
          <div key={d.key} className="contents">
            <dt className="text-muted-foreground print:text-black">
              {tm(`plan.detail.${d.key}`)}
            </dt>
            <dd className="break-words" lang={planLang}>
              {d.value}
            </dd>
          </div>
        ))}
        {plan.modeLabel && (
          <>
            <dt className="text-muted-foreground print:text-black">
              {tm("plan.madeWith")}
            </dt>
            <dd lang={planLang}>{plan.modeLabel}</dd>
          </>
        )}
        {plan.submittedAt && (
          <>
            <dt className="text-muted-foreground print:text-black">
              {tm("plan.sentToRops")}
            </dt>
            <dd>{fmtDate(plan.submittedAt, locale)}</dd>
          </>
        )}
      </dl>
      <div lang={planLang}>
        <PlanMarkdown markdown={plan.markdown} className="mt-6" />
      </div>
      <p className="text-muted-foreground mt-10 text-sm print:text-black">
        {t("plan.footer", { owner: site.owner })}
      </p>
    </div>
  );
}
