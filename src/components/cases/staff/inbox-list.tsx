"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { AlertTriangleIcon, ClockIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  CASE_KIND_LABEL,
  CASE_KINDS,
  CASE_STATUS_LABEL,
  CASE_STATUSES,
  MAPA_AREA_LABEL,
  MAPA_AREAS,
  URGENCY_LABEL,
  type CaseKind,
  type CaseStatus,
  type MapaArea,
} from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ageLabel, hoursSince, plural } from "../format";
import { caseHref } from "./labels";

const pick = <T extends string>(v: string | null, all: readonly T[]) =>
  v && (all as readonly string[]).includes(v) ? (v as T) : undefined;

const selectClass =
  "border-input bg-background min-h-12 w-full rounded-md border px-3 text-base";

/** The inbox: filters (kept in the URL), unread markers, urgency, age, triage summary. */
export function InboxList({
  basePath,
}: {
  basePath: "/admin/cases" | "/expert";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = pick<CaseStatus>(sp.get("status"), CASE_STATUSES);
  const kind = pick<CaseKind>(sp.get("kind"), CASE_KINDS);
  const area = pick<MapaArea>(sp.get("area"), MAPA_AREAS);
  const qParam = sp.get("q") ?? "";
  const waiting = sp.get("waiting") === "1";
  const [q, setQ] = useState(qParam);
  useEffect(() => setQ(qParam), [qParam]);

  const list = api.admin.inbox.list.useQuery(
    {
      status,
      kind,
      area,
      q: qParam || undefined,
      waiting: waiting || undefined,
    },
    { refetchInterval: 10_000, placeholderData: keepPreviousData },
  );

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
          Rodzaj sprawy
        </p>
        <ul className="flex flex-wrap gap-2">
          {chip(undefined, "Wszystkie", allCount)}
          {CASE_KINDS.map((k) =>
            chip(k, CASE_KIND_LABEL[k], counts ? counts[k] : null),
          )}
        </ul>
      </div>
      <form
        role="search"
        aria-label="Filtry spraw"
        className="border-hairline grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q.trim() || undefined);
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="f-status" className="font-semibold">
            Status
          </label>
          <select
            id="f-status"
            value={status ?? ""}
            onChange={(e) => setParam("status", e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">Wszystkie</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-area" className="font-semibold">
            Obszar
          </label>
          <select
            id="f-area"
            value={area ?? ""}
            onChange={(e) => setParam("area", e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">Wszystkie</option>
            {MAPA_AREAS.map((a) => (
              <option key={a} value={a}>
                {MAPA_AREA_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-q" className="font-semibold">
            Szukaj
          </label>
          <div className="flex gap-2">
            <input
              id="f-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kod, tytuł lub treść"
              className={selectClass}
            />
            <Button
              type="submit"
              variant="outline"
              className="h-auto min-h-12 max-w-full px-3 whitespace-normal"
              aria-label="Szukaj"
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
          Tylko sprawy, które czekają ponad 48 h
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
              Wyczyść filtry
            </Button>
          </div>
        )}
      </form>

      <p role="status" aria-live="polite" className="font-semibold">
        {list.isPending
          ? "Wczytuję sprawy…"
          : list.error
            ? "Nie udało się wczytać spraw."
            : `${rows.length} ${plural(rows.length, ["sprawa", "sprawy", "spraw"])}${unread ? `, w tym ${unread} z nowymi powiadomieniami` : ""}.`}
      </p>

      {rows.length > 0 && (
        <ul className="border-hairline border-t">
          {rows.map((r) => {
            const open =
              r.status === "new" ||
              r.status === "triaged" ||
              r.status === "in_progress";
            const late = open && hoursSince(r.lastActivityAt) > 48;
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
                        Nowe
                      </span>
                    )}
                    {r.urgency === "high" && (
                      <span className="border-destructive text-destructive inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold">
                        <AlertTriangleIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        Pilne
                      </span>
                    )}
                    <span className="font-mono font-semibold">{r.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="border-input rounded-sm border px-2 py-0.5 font-semibold">
                      {CASE_KIND_LABEL[r.kind]}
                    </span>
                    {r.isSample && (
                      <span className="border-hairline rounded border px-2 py-0.5">
                        przykładowe
                      </span>
                    )}
                  </p>
                  <Link
                    href={caseHref(basePath, r.code)}
                    className="text-lg font-semibold break-words"
                  >
                    {r.title}
                  </Link>
                  <p
                    className={cn(
                      "break-words",
                      !r.summary && "text-muted-foreground",
                    )}
                  >
                    {r.summary ??
                      (r.triageSource === "keywords"
                        ? "Wstępna ocena AI niedostępna — oceń ręcznie."
                        : "Trwa wstępna ocena…")}
                  </p>
                  {(r.areas.length > 0 || r.assigneeName) && (
                    <p className="text-muted-foreground text-sm">
                      {r.areas.length > 0 &&
                        `Obszar: ${r.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")}`}
                      {r.areas.length > 0 && r.assigneeName && " · "}
                      {r.assigneeName && `Przydzielona: ${r.assigneeName}`}
                    </p>
                  )}
                </div>
                <dl className="grid grid-cols-1 content-start gap-x-2 text-sm sm:min-w-52 sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted-foreground">Status:</dt>
                  <dd className="font-semibold">
                    {CASE_STATUS_LABEL[r.status]}
                  </dd>
                  <dt className="text-muted-foreground">Pilność:</dt>
                  <dd>
                    {r.urgency ? URGENCY_LABEL[r.urgency] : "nieoceniona"}
                  </dd>
                  <dt className="text-muted-foreground">Zgłoszona:</dt>
                  <dd>{ageLabel(r.createdAt)}</dd>
                  <dt className="text-muted-foreground">Ruch:</dt>
                  <dd>
                    {ageLabel(r.lastActivityAt)}
                    {late && (
                      <span className="text-destructive ml-1 inline-flex items-center gap-1 font-semibold">
                        <ClockIcon aria-hidden="true" className="size-3.5" />
                        czeka ponad 48 h
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
            ? "Żadna sprawa nie pasuje do filtrów."
            : basePath === "/expert"
              ? "Nie masz jeszcze przydzielonych spraw."
              : "Skrzynka jest pusta."}
        </p>
      )}
    </div>
  );
}
