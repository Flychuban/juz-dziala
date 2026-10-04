"use client";

import { ArrowRightIcon, CopyIcon, PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { CaseCode, copyText } from "./case-code";
import { rememberCase } from "./my-cases";

/**
 * Shown by any module right after `createCase()` returns: the big code,
 * „Zapisz lub wydrukuj ten kod", copy, print, the private link, a way into
 * the case and „Co dzieje się dalej" (how ROPS is told and how the reply
 * comes back — only what the system really does). Saves the code on this
 * device. Focus moves to the heading so a screen reader announces the result.
 *
 *   <CaseCreatedPanel code={res.code} token={res.accessToken} />
 */
export function CaseCreatedPanel({
  code,
  token,
  heading,
}: {
  code: string;
  token: string;
  heading?: string;
}) {
  const t = useTranslations("cases.created");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [origin, setOrigin] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const tokenQuery = `?t=${encodeURIComponent(token)}`;
  const privatePath = `/case/${code}${tokenQuery}`;

  useEffect(() => {
    setSaved(rememberCase(code, token));
    setOrigin(window.location.origin);
    headingRef.current?.focus();
  }, [code, token]);

  return (
    <section
      aria-labelledby="case-created-heading"
      className="border-hairline bg-background rounded-lg border-2 p-5 [overflow-wrap:anywhere] sm:p-8"
    >
      <h2
        id="case-created-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold sm:text-3xl"
      >
        {heading ?? t("heading")}
      </h2>
      <p className="mt-2 text-lg">{t("lead")}</p>

      <CaseCode code={code} className="mt-6" />

      <p className="mt-6 text-lg font-semibold">{t("keep")}</p>
      <p className="mt-1">{t("keepWhy")}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          asChild
          className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
        >
          <Link href={privatePath}>
            {t("open")}
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
        >
          <Link href={`/case/${code}/print${tokenQuery}`}>
            <PrinterIcon aria-hidden="true" />
            {t("print")}
          </Link>
        </Button>
      </div>

      <WhatNext code={code} token={token} />

      <div className="border-hairline mt-8 border-t pt-6">
        <label htmlFor="case-private-link" className="block font-semibold">
          {t("privateLink")}
        </label>
        <p
          id="case-private-link-hint"
          className="text-muted-foreground text-sm"
        >
          {t("privateLinkHint")}
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="case-private-link"
            readOnly
            value={`${origin}${privatePath}`}
            aria-describedby="case-private-link-hint"
            onFocus={(e) => e.currentTarget.select()}
            className="border-input bg-background min-h-12 w-full rounded-md border px-3 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
            onClick={async () => {
              const ok = await copyText(`${origin}${privatePath}`);
              setLinkStatus(ok ? t("linkCopied") : t("linkCopyFailed"));
            }}
          >
            <CopyIcon aria-hidden="true" />
            {t("copyLink")}
          </Button>
        </div>
        <p role="status" className="mt-1 text-sm">
          {linkStatus}
        </p>
      </div>

      {saved !== null && (
        <p className="text-muted-foreground mt-4 text-sm">
          {saved ? t("savedOnDevice") : t("notSaved")}
        </p>
      )}
    </section>
  );
}

/**
 * „Co dzieje się dalej" — sponsor §6: how the administrator is told and how
 * the reply reaches the author. Channel wording comes from the server
 * (`cases.whatNext`), so a demo never promises a real e-mail or SMS.
 */
function WhatNext({ code, token }: { code: string; token: string }) {
  const t = useTranslations("cases.created.next");
  const q = api.cases.whatNext.useQuery(
    { code, token },
    { staleTime: Infinity, retry: false },
  );
  const d = q.data;
  const channel = d?.contactPref ?? "none";
  const note = !d
    ? null
    : d.email === "off"
      ? t("noteOff")
      : d.email === "demo"
        ? t("noteDemo")
        : channel === "sms"
          ? t("noteSms")
          : null;

  const steps = [
    d?.staffEmail ? t("staffWithEmail") : t("staff"),
    t("ai"),
    t("reply", { code, channel }),
  ];

  return (
    <section
      aria-labelledby="case-next-heading"
      className="border-hairline mt-8 border-t pt-6"
    >
      <h3 id="case-next-heading" className="text-xl font-bold">
        {t("heading")}
      </h3>
      <ol className="mt-4 flex flex-col gap-4">
        {steps.map((text, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden="true"
              className="border-primary text-primary inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums"
            >
              {i + 1}
            </span>
            <p className="pt-0.5">{text}</p>
          </li>
        ))}
      </ol>
      {note ? (
        <p className="border-input mt-4 border-l-4 pl-3 text-[0.9375rem]">
          {note}
        </p>
      ) : null}
    </section>
  );
}
