import { type Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { PlanMarkdown } from "~/components/adapt/plan-markdown";
import { PrintButton } from "~/components/cases/print-button";
import { formatDate } from "~/components/kit/format";
import { isLocale } from "~/i18n/config";
import { labelsFor } from "~/lib/domain";
import { readStoredPlan } from "~/server/adapt/stored-plan";
import { findCaseByCode } from "~/server/cases/queries";
import { normalizeCaseCode } from "~/server/domain/case-code";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adapt.casePlan");
  return { title: t("metaTitle") };
}

/** The full Ramowy Plan Wdrożenia of an „adapt" case, laid out for A4. */
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const typed = decodeURIComponent((await params).code);
  const code = normalizeCaseCode(typed);
  if (!code) notFound();
  if (code !== typed) redirect(`/case/${code}/plan`);
  const c = await findCaseByCode(code);
  if (c?.kind !== "adapt") notFound();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : "pl";
  const plan = readStoredPlan(c.plan, locale);
  if (!plan) notFound();
  const t = await getTranslations("adapt.casePlan");
  const site = labelsFor(locale).site;
  // The plan is written in its author's language; say so when it differs.
  const planLang = plan.locale !== locale ? plan.locale : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 [overflow-wrap:anywhere] print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 16mm; }"}</style>
      <div className="mb-6 flex flex-wrap items-center gap-3" data-no-print>
        <PrintButton label={t("print")} />
        <Link
          href={`/case/${c.code}`}
          className="inline-flex min-h-12 items-center px-2 underline"
        >
          {t("back")}
        </Link>
      </div>
      <p className="text-muted-foreground font-semibold print:text-black">
        {site.name} · {site.hub} · {t("case")}{" "}
        <span className="font-mono">{c.code}</span>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{t("title")}</h1>
      <dl className="mt-4 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr] print:grid-cols-[auto_1fr]">
        {plan.details.map((d) => (
          <div key={d.label} className="contents">
            <dt className="text-muted-foreground print:text-black">{d.label}</dt>
            <dd className="break-words">{d.value}</dd>
          </div>
        ))}
        {plan.submittedAt ? (
          <>
            <dt className="text-muted-foreground print:text-black">{t("sent")}</dt>
            <dd>{formatDate(plan.submittedAt, locale)}</dd>
          </>
        ) : null}
      </dl>
      <div lang={planLang}>
        <PlanMarkdown markdown={plan.markdown} className="mt-6" />
      </div>
      <p className="text-muted-foreground mt-10 text-sm print:text-black">
        {t("footer", { owner: site.owner })}
      </p>
    </div>
  );
}
