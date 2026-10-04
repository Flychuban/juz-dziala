"use client";

import { SearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { fmtDate, looseCaseCode } from "./format";
import { forgetCase, readMyCases, type SavedCase } from "./my-cases";

/**
 * Big, format-tolerant code entry for /case. Without JavaScript the form is a
 * plain GET to /case?code=…, which redirects to the case page.
 */
export function CaseLookup({
  initialValue = "",
  initialError,
}: {
  initialValue?: string;
  initialError?: string;
}) {
  const t = useTranslations("cases.lookup");
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialError) inputRef.current?.focus();
  }, [initialError]);

  return (
    <form
      noValidate
      action="/case"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const code = looseCaseCode(value);
        if (!code) {
          setError(value.trim() ? t("invalidLoose") : t("empty"));
          inputRef.current?.focus();
          return;
        }
        setError("");
        setBusy(true);
        router.push(`/case/${code}`);
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor="case-code" className="text-xl font-semibold">
        {t("label")}
      </label>
      <p id="case-code-hint" className="text-muted-foreground">
        {t("hint")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          id="case-code"
          name="code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          placeholder="JD-XXXX-XXXX"
          aria-describedby={
            error ? "case-code-hint case-code-error" : "case-code-hint"
          }
          aria-invalid={error ? true : undefined}
          className="border-input bg-background placeholder:text-muted-foreground aria-invalid:border-destructive min-h-14 w-full rounded-md border-2 px-4 font-mono text-2xl tracking-wider uppercase sm:max-w-md"
        />
        <Button
          type="submit"
          disabled={busy}
          className="h-auto min-h-14 max-w-full px-6 text-lg font-semibold whitespace-normal"
        >
          <SearchIcon aria-hidden="true" />
          {busy ? t("checking") : t("submit")}
        </Button>
      </div>
      {error && (
        <p
          id="case-code-error"
          role="alert"
          className="text-destructive font-semibold"
        >
          {error}
        </p>
      )}
    </form>
  );
}

/** „Twoje sprawy na tym urządzeniu" — read from localStorage after mount. */
export function MyCases() {
  const t = useTranslations("cases");
  const locale = useLocale();
  const [saved, setSaved] = useState<SavedCase[] | null>(null);
  useEffect(() => setSaved(readMyCases()), []);
  const codes = saved?.map((s) => s.code) ?? [];
  const q = api.cases.byCodes.useQuery(
    { codes: codes.slice(0, 20) },
    { enabled: codes.length > 0, refetchInterval: 60_000 },
  );
  // A code the server no longer knows is dropped from this device, so the
  // next poll does not count it as a wrong guess again.
  useEffect(() => {
    if (!q.data || !saved) return;
    const known = new Set(q.data.map((c) => c.code));
    const stale = saved.filter((s) => !known.has(s.code));
    if (stale.length === 0) return;
    for (const s of stale) forgetCase(s.code);
    setSaved(readMyCases());
  }, [q.data, saved]);

  if (saved === null) return null;
  return (
    <section aria-labelledby="my-cases-heading" className="mt-12">
      <h2 id="my-cases-heading" className="text-2xl font-bold">
        {t("mine.heading")}
      </h2>
      {codes.length === 0 ? (
        <p className="text-muted-foreground mt-2">{t("mine.empty")}</p>
      ) : q.isPending ? (
        <p role="status" className="mt-2">
          {t("mine.loading")}
        </p>
      ) : q.error ? (
        <p role="alert" className="mt-2">
          {t("mine.error")}
        </p>
      ) : (
        <ul className="border-hairline mt-4 flex flex-col border-t">
          {q.data.map((c) => {
            const s = saved.find((x) => x.code === c.code);
            const fresh =
              c.lastStaffReplyAt &&
              (!s?.lastSeenAt ||
                new Date(c.lastStaffReplyAt) > new Date(s.lastSeenAt));
            const href = s?.token
              ? `/case/${c.code}?t=${encodeURIComponent(s.token)}`
              : `/case/${c.code}`;
            return (
              <li
                key={c.code}
                className="border-hairline flex flex-col gap-2 border-b py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <Link
                    href={href}
                    className="font-mono text-lg font-bold underline"
                  >
                    {c.code}
                  </Link>
                  <p>
                    {t(`kind.${c.kind}`)}: {c.title}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t("mine.meta", {
                      status: t(`status.${c.status}`),
                      date: fmtDate(c.createdAt, locale),
                    })}
                  </p>
                  {fresh && (
                    <Badge className="h-auto px-2.5 py-1 text-sm">
                      {t("mine.newReply")}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
                  onClick={() => {
                    forgetCase(c.code);
                    setSaved(readMyCases());
                  }}
                >
                  {t("mine.forget")}
                  <span className="sr-only">
                    {" "}
                    {t("mine.forgetSr", { code: c.code })}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
