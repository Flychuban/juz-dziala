"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { AlertTriangleIcon, ClockIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SampleBadge } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { relativeAge } from "~/i18n/relative";
import { useLabels } from "~/i18n/use-labels";
import {
  CASE_KINDS,
  CASE_STATUSES,
  MAPA_AREAS,
  type CaseKind,
} from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { caseHref, hoursSince, inboxInput, isOpenStatus } from "./labels";
import { textLang } from "~/lib/text-lang";

const selectClass =
  "border-input bg-background min-h-12 w-full rounded-md border px-3 text-base";

/** The inbox: filters (kept in the URL), unread markers, urgency, age, triage summary. */
export function InboxList({
  basePath,
}: {
  basePath: "/admin/cases" | "/expert";
}) {
  const t = useTranslations("admin.inbox");
  const tl = useTranslations("admin.labels");
  const tt = useTranslations("common.time");
  const L = useLabels();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const input = inboxInput((k) => sp.get(k));
  const { status, kind, area } = input;
  const qParam = input.q ?? "";
  const waiting = input.waiting ?? false;
  const [q, setQ] = useState(qParam);
  useEffect(() => setQ(qParam), [qParam]);

  const list = api.admin.inbox.list.useQuery(input, {
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const filtered = Boolean(status ?? kind ?? area ?? (qParam || waiting));
  const rows = list.data?.items ?? [];
  const counts = list.data?.kindCounts;
  const allCount = counts
    ? CASE_KINDS.reduce((n, k) => n + counts[k], 0)
    : null;
  const unread = rows.filter((r) => r.unread).length;

  const chip = (
    value: CaseKind | undefined,
    text: string,
    n: number | null,
  ) => {
    const active = kind === value;
    return (
      <li key={value ?? "all"}>
        <button
          type="button"
          aria-pressed={active}
          onClick={() => setParam("kind", value)}
          className={cn(
            "inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-base font-medium",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-accent",
          )}
        >
          {text}
          {n != null && (
            <span className="font-bold tabular-nums">
              <span className="sr-only">: </span>
              {n}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 [overflow-wrap:anywhere]">
      <div role="group" aria-labelledby="kind-chips-label">
        <p id="kind-chips-label" className="mb-2 font-semibold">
          {t("kindChips")}
        </p>
        <ul className="flex flex-wrap gap-2">
          {chip(undefined, t("all"), allCount)}
          {CASE_KINDS.map((k) =>
            chip(k, L.caseKind[k], counts ? counts[k] : null),
          )}
        </ul>
      </div>
      <form
        role="search"
        aria-label={t("filters")}
        className="border-hairline grid gap-4 border-y py-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q.trim() || undefined);
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="f-status" className="font-semibold">
            {t("status")}
          </label>
          <select
            id="f-status"
            value={status ?? ""}
            onChange={(e) => setParam("status", e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">{t("all")}</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {L.caseStatus[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-area" className="font-semibold">
            {t("area")}
          </label>
          <select
            id="f-area"
            value={area ?? ""}
            onChange={(e) => setParam("area", e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">{t("all")}</option>
            {MAPA_AREAS.map((a) => (
              <option key={a} value={a}>
                {L.area[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-q" className="font-semibold">
            {t("search")}
          </label>
          <div className="flex gap-2">
            <input
              id="f-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className={selectClass}
            />
            <Button
              type="submit"
              variant="outline"
              className="h-auto min-h-12 max-w-full px-3 whitespace-normal"
              aria-label={t("search")}
            >
              <SearchIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        <label className="flex min-h-12 items-center gap-3 sm:col-span-2 lg:col-span-3">
          <input
            type="checkbox"
            checked={waiting}
            onChange={(e) =>
              setParam("waiting", e.target.checked ? "1" : undefined)
            }
            className="size-5"
          />
          {t("waitingOnly")}
        </label>
        {filtered && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-12 max-w-full px-3 text-base whitespace-normal underline"
              onClick={() =>
                router.replace(
                  basePath === "/expert" ? "/expert" : "/admin/cases",
                  { scroll: false },
                )
              }
            >
              {t("clear")}
            </Button>
          </div>
        )}
      </form>

      <p role="status" aria-live="polite" className="font-semibold">
        {list.isPending
          ? t("loading")
          : list.error
            ? t("error")
            : t("summary", { count: rows.length, unread })}
      </p>

      {rows.length > 0 && (
        <ul className="border-hairline border-t">
          {rows.map((r) => {
            const late =
              isOpenStatus(r.status) && hoursSince(r.lastActivityAt) > 48;
            return (
              <li
                key={r.code}
                className={cn(
                  "border-hairline grid gap-2 border-b py-4 sm:grid-cols-[1fr_auto] sm:gap-6",
                  r.unread && "border-l-primary border-l-4 pl-3",
                )}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    {r.unread && (
                      <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 font-bold">
                        {t("new")}
                      </span>
                    )}{" "}
                    {r.urgency === "high" && (
                      <span className="border-destructive text-destructive inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold">
                        <AlertTriangleIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        {tl("urgent")}
                      </span>
                    )}{" "}
                    <span className="font-mono font-semibold">{r.code}</span>{" "}
                    <span aria-hidden="true">·</span>{" "}
                    <span className="border-input rounded-sm border px-2 py-0.5 font-semibold">
                      {L.caseKind[r.kind]}
                    </span>
                    {r.isSample && (
                      <>
                        {" "}
                        <SampleBadge />
                      </>
                    )}
                    {r.locale === "en" && (
                      <span className="text-muted-foreground">
                        · {t("english")}
                      </span>
                    )}
                  </p>
                  <Link
                    href={caseHref(basePath, r.code)}
                    className="text-lg font-semibold break-words"
                  >
                    <span lang={textLang(r.title)}>{r.title}</span>
                  </Link>
                  <p
                    className={cn(
                      "break-words",
                      !r.summary && "text-muted-foreground",
                    )}
                    lang={
                      r.summaryLang && r.summaryLang !== locale
                        ? r.summaryLang
                        : undefined
                    }
                  >
                    {r.summary ??
                      (r.triageSource === "keywords"
                        ? t("triageUnavailable")
                        : t("triagePending"))}
                  </p>
                  {(r.areas.length > 0 || r.assigneeName) && (
                    <p className="text-muted-foreground text-sm">
                      {r.areas.length > 0 &&
                        t("areas", {
                          areas: r.areas.map((a) => L.area[a]).join(", "),
                        })}
                      {r.areas.length > 0 && r.assigneeName && " · "}
                      {r.assigneeName &&
                        t("assigned", { name: r.assigneeName })}
                    </p>
                  )}
                </div>
                <dl className="grid grid-cols-1 content-start gap-x-2 text-sm sm:min-w-52 sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted-foreground">{t("statusLabel")}</dt>
                  <dd className="font-semibold">{L.caseStatus[r.status]}</dd>
                  <dt className="text-muted-foreground">{t("urgencyLabel")}</dt>
                  <dd>{r.urgency ? L.urgency[r.urgency] : tl("unassessed")}</dd>
                  <dt className="text-muted-foreground">{t("createdLabel")}</dt>
                  <dd>{relativeAge(r.createdAt, tt)}</dd>
                  <dt className="text-muted-foreground">
                    {t("activityLabel")}
                  </dt>
                  <dd>
                    {relativeAge(r.lastActivityAt, tt)}
                    {late && (
                      <span className="text-destructive ml-1 inline-flex items-center gap-1 font-semibold">
                        <ClockIcon aria-hidden="true" className="size-3.5" />
                        {t("waiting")}
                      </span>
                    )}
                  </dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
      {!list.isPending && !list.error && rows.length === 0 && (
        <p className="text-muted-foreground">
          {filtered
            ? t("emptyFiltered")
            : basePath === "/expert"
              ? t("emptyExpert")
              : t("empty")}
        </p>
      )}
    </div>
  );
}
