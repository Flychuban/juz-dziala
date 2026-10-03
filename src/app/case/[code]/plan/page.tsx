import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanMarkdown } from "~/components/adapt/plan-markdown";
import { fmtDate } from "~/components/cases/format";
import { PrintButton } from "~/components/cases/print-button";
import { SITE } from "~/lib/domain";
import { casePayloads } from "~/server/cases/payloads";
import { findCaseByCode } from "~/server/cases/queries";
import { normalizeCaseCode } from "~/server/domain/case-code";

export const metadata = { title: "Ramowy Plan Wdrożenia do druku" };

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
  const { plan } = await casePayloads(c, { staff: false });
  if (!plan) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 16mm; }"}</style>
      <div className="mb-6 flex flex-wrap items-center gap-3" data-no-print>
        <PrintButton label="Drukuj plan" />
        <Link
          href={`/case/${c.code}`}
          className="inline-flex min-h-12 items-center px-2 underline"
        >
          Wróć do sprawy
        </Link>
      </div>
      <p className="text-muted-foreground font-semibold print:text-black">
        {SITE.name} · {SITE.hub} · sprawa{" "}
        <span className="font-mono">{c.code}</span>
      </p>
      <h1 className="mt-2 text-3xl font-bold">Ramowy Plan Wdrożenia</h1>
      <dl className="mt-4 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr] print:grid-cols-[auto_1fr]">
        {plan.details.map((d) => (
          <div key={d.label} className="contents">
            <dt className="text-muted-foreground print:text-black">
              {d.label}
            </dt>
            <dd className="break-words">{d.value}</dd>
          </div>
        ))}
        {plan.submittedAt && (
          <>
            <dt className="text-muted-foreground print:text-black">
              Wysłano do ROPS
            </dt>
            <dd>{fmtDate(plan.submittedAt)}</dd>
          </>
        )}
      </dl>
      <PlanMarkdown markdown={plan.markdown} className="mt-6" />
      <p className="text-muted-foreground mt-10 text-sm print:text-black">
        Projekt planu do omówienia z Zespołem Hubu. Kwoty i terminy oznaczone
        „do weryfikacji” wymagają sprawdzenia. {SITE.owner}.
      </p>
    </div>
  );
}
