import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { fmtDate } from "~/components/cases/format";
import { PrintButton } from "~/components/cases/print-button";
import { labelsFor } from "~/lib/domain";
import { caseForPage, ownsCase } from "~/server/cases/access";
import { normalizeCaseCode } from "~/server/domain/case-code";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cases.meta");
  return { title: t("print") };
}

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
 * and three plain steps. Handed to the person the case is about. Opened with
 * the private-link token (`?t=`), the QR code carries it, so whoever scans it
 * can also reply. A wrong code counts as a guess, as on the case page.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp] = await Promise.all([params, searchParams]);
  const typed = decodeURIComponent(raw);
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const code = normalizeCaseCode(typed);
  if (!code) notFound();
  if (code !== typed) {
    redirect(
      `/case/${code}/print${token ? `?t=${encodeURIComponent(token)}` : ""}`,
    );
  }
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
  const locale = await getLocale();
  const site = labelsFor(locale).site;
  const canReply = ownsCase(c, token);

  const base = await origin();
  const url = `${base}/case/${c.code}${canReply && token ? `?t=${encodeURIComponent(token)}` : ""}`;
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto max-w-[210mm] px-4 py-8 [overflow-wrap:anywhere] print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 16mm; }"}</style>
      <div className="mb-6 flex flex-wrap items-center gap-3" data-no-print>
        <PrintButton label={t("print.printSheet")} />
        <Link
          href={`/case/${c.code}${canReply && token ? `?t=${encodeURIComponent(token)}` : ""}`}
          className="inline-flex min-h-12 items-center px-2 underline"
        >
          {t("print.back")}
        </Link>
      </div>

      <article className="border-hairline rounded-lg border p-8 print:rounded-none print:border-0 print:p-0">
        <p className="text-muted-foreground font-semibold print:text-black">
          {site.name} · {site.hub}
        </p>
        <h1 className="mt-4 text-3xl font-bold">{t("print.heading")}</h1>
        <p className="mt-3 font-mono text-[clamp(1.75rem,9vw,3rem)] leading-tight font-bold tracking-wider print:text-[40pt]">
          {c.code}
        </p>

        <div className="mt-8 flex flex-col gap-8 sm:flex-row print:flex-row">
          <Image
            src={qr}
            unoptimized
            width={200}
            height={200}
            alt={t("print.qrAlt")}
            className="border-hairline size-[200px] shrink-0 border"
          />
          <dl className="grid content-start gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground print:text-black">
              {t("view.kind")}
            </dt>
            <dd className="font-semibold">{t(`kind.${c.kind}`)}</dd>
            <dt className="text-muted-foreground print:text-black">
              {t("print.subject")}
            </dt>
            <dd className="font-semibold break-words">{c.title}</dd>
            <dt className="text-muted-foreground print:text-black">
              {t("view.created")}
            </dt>
            <dd>{fmtDate(c.createdAt, locale)}</dd>
          </dl>
        </div>

        {c.onBehalf && (
          <p className="mt-8 text-lg">
            {t("print.onBehalf", { reply: canReply ? "yes" : "no" })}
          </p>
        )}

        <h2 className="mt-8 text-2xl font-bold">{t("print.howTo")}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-lg">
          <li>{t("print.step1")}</li>
          <li>
            {t.rich("print.step2", {
              site: `${base}/case`,
              code: c.code,
              b: (chunks) => (
                <span className="font-semibold break-all">{chunks}</span>
              ),
              mono: (chunks) => (
                <span className="font-mono font-bold">{chunks}</span>
              ),
            })}
          </li>
          <li>{t("print.step3", { reply: canReply ? "yes" : "no" })}</li>
        </ol>
        <p className="mt-6 font-semibold">
          {t("print.keep", { reply: canReply ? "yes" : "no" })}
        </p>
        <p className="text-muted-foreground mt-8 text-sm print:text-black">
          {site.owner} · {site.ownerLine}
        </p>
      </article>
    </div>
  );
}
