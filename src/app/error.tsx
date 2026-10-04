"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { btnPrimary } from "~/components/match/styles";

/** Any client exception lands here with a way out — never a blank „Application error". */
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations("common.error");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-lg">{t("body")}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" className={btnPrimary} onClick={() => window.location.reload()}>
          {t("reload")}
        </button>
        <Link href="/" className="inline-flex min-h-12 items-center font-semibold underline">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
