import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { fmtDate } from "~/components/cases/format";
import { PrintButton } from "~/components/cases/print-button";
import { CASE_KIND_LABEL, SITE } from "~/lib/domain";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { findCaseByCode } from "~/server/cases/queries";

export const metadata = { title: "Kod sprawy do druku" };

/** The public site URL, else this request's origin (same deployment). */
async function origin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * A4 sheet for „Zgłaszam w imieniu": the code, a QR code to the case page
 * and three plain steps. Handed to the person the case is about.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const typed = decodeURIComponent((await params).code);
  const code = normalizeCaseCode(typed);
  if (!code) notFound();
  if (code !== typed) redirect(`/case/${code}/print`);
  const c = await findCaseByCode(code);
  if (!c) notFound();

  const base = await origin();
  const url = `${base}/case/${c.code}`;
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto max-w-[210mm] px-4 py-8 [overflow-wrap:anywhere] print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 16mm; }"}</style>
      <div className="mb-6 flex flex-wrap items-center gap-3" data-no-print>
        <PrintButton label="Drukuj kartkę" />
        <Link
          href={`/case/${c.code}`}
          className="inline-flex min-h-12 items-center px-2 underline"
        >
          Wróć do sprawy
        </Link>
      </div>

      <article className="border-hairline rounded-lg border p-8 print:rounded-none print:border-0 print:p-0">
        <p className="text-muted-foreground font-semibold print:text-black">
          {SITE.name} · {SITE.hub}
        </p>
        <h1 className="mt-4 text-3xl font-bold">Kod Twojej sprawy</h1>
        <p className="mt-3 font-mono text-[clamp(1.75rem,9vw,3rem)] leading-tight font-bold tracking-wider print:text-[40pt]">
          {c.code}
        </p>

        <div className="mt-8 flex flex-col gap-8 sm:flex-row print:flex-row">
          <Image
            src={qr}
            unoptimized
            width={200}
            height={200}
            alt={`Kod QR. Prowadzi do strony sprawy: ${url}`}
            className="border-hairline size-[200px] shrink-0 border"
          />
          <dl className="grid content-start gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground print:text-black">Rodzaj</dt>
            <dd className="font-semibold">{CASE_KIND_LABEL[c.kind]}</dd>
            <dt className="text-muted-foreground print:text-black">Temat</dt>
            <dd className="font-semibold break-words">{c.title}</dd>
            <dt className="text-muted-foreground print:text-black">
              Zgłoszona
            </dt>
            <dd>{fmtDate(c.createdAt)}</dd>
          </dl>
        </div>

        {c.onBehalf && (
          <p className="mt-8 text-lg">
            Ktoś zgłosił tę sprawę w Twoim imieniu. Możesz sam(a) sprawdzić
            odpowiedź i dopisać wiadomość.
          </p>
        )}

        <h2 className="mt-8 text-2xl font-bold">Jak sprawdzić odpowiedź?</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-lg">
          <li>Zeskanuj kod QR aparatem w telefonie.</li>
          <li>
            Albo wejdź na stronę{" "}
            <span className="font-semibold break-all">{base}/case</span> i wpisz
            kod sprawy: <span className="font-mono font-bold">{c.code}</span>.
          </li>
          <li>Przeczytaj odpowiedź Zespołu Hubu. Możesz od razu odpisać.</li>
        </ol>
        <p className="mt-6 text-lg">
          Odpowiadamy zwykle w ciągu 2 dni roboczych.
        </p>
        <p className="mt-6 font-semibold">
          Zachowaj tę kartkę. Kod otwiera Twoją sprawę — nie podawaj go obcym
          osobom.
        </p>
        <p className="text-muted-foreground mt-8 text-sm print:text-black">
          {SITE.owner} · {SITE.ownerLine}
        </p>
      </article>
    </div>
  );
}
