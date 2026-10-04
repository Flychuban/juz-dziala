"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * „English" / „Polski" — a plain link to /api/lang, so it works before
 * JavaScript loads. The label is in the target language (lang attribute set),
 * the hint in the current one.
 */
export function LanguageSwitch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("common.lang");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const to = locale === "en" ? "pl" : "en";
  const next = pathname + (search ? `?${search}` : "");
  return (
    <a
      href={`/api/lang?to=${to}&next=${encodeURIComponent(next)}`}
      hrefLang={to}
      lang={to}
      title={t("switchHint")}
      aria-label={compact ? `${t("switchLabel")} (${to.toUpperCase()})` : undefined}
      className={
        className ??
        "border-input bg-background text-foreground hover:bg-accent inline-flex min-h-12 items-center justify-center rounded-md border px-3 text-sm font-semibold no-underline"
      }
    >
      {compact ? to.toUpperCase() : t("switchLabel")}
    </a>
  );
}
