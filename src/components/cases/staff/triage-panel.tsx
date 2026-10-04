"use client";

import {
  AlertTriangleIcon,
  RefreshCwIcon,
  SparklesIcon,
  UserCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatDate, SampleBadge } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useLabels } from "~/i18n/use-labels";
import { triageSummary } from "~/server/admin/triage-shape";
import { CRISIS_RESOURCES } from "~/server/domain/crisis";
import { api, type RouterOutputs } from "~/trpc/react";
import { caseHref } from "./labels";

type Data = RouterOutputs["admin"]["inbox"]["get"];

const AI_STATUSES = [
  "unavailable",
  "refusal",
  "max_tokens",
  "invalid",
  "error",
  "timeout",
] as const;
const CRISIS = ["suicide", "self_harm", "violence", "danger", "child"] as const;
const known = <T extends string>(all: readonly T[], v: string): v is T =>
  (all as readonly string[]).includes(v);

/**
 * The AI triage panel. The reply draft is editable here and only reaches the
 * reply form through „Użyj szkicu" — nothing is ever sent automatically.
 * Without AI it says so plainly and offers keyword leads instead.
 */
export function TriagePanel({
  data,
  basePath,
  onUseDraft,
}: {
  data: Data;
  basePath: "/admin/cases" | "/expert";
  onUseDraft: (text: string) => void;
}) {
  const t = useTranslations("admin.triage");
  const tl = useTranslations("admin.labels");
  const tk = useTranslations("common.kit");
  const L = useLabels();
  const locale = useLocale();
  const tr = data.triage;
  const utils = api.useUtils();
  const [draft, setDraft] = useState(tr?.replyDraft ?? "");
  const [msg, setMsg] = useState("");
  useEffect(
    () => setDraft(tr?.replyDraft ?? ""),
    [tr?.createdAt, tr?.replyDraft],
  );

  const aiReason = (s: string | undefined) =>
    s && known(AI_STATUSES, s) ? tl(`aiStatus.${s}`) : (s ?? t("errorFallback"));
  const crisisLabel = (c: string) =>
    known(CRISIS, c) ? tl(`crisis.${c}`) : c;

  const retriage = api.admin.inbox.retriage.useMutation({
    onSuccess: async (r) => {
      setMsg(
        r.triage?.source === "ai"
          ? t("ready")
          : t("stillUnavailable", { reason: aiReason(r.triage?.aiStatus) }),
      );
      await utils.admin.inbox.get.invalidate({ code: data.case.code });
    },
    onError: (e) => setMsg(e.message),
  });
  const assign = api.admin.inbox.assign.useMutation({
    onSuccess: async () => {
      setMsg(t("assigned"));
      await utils.admin.inbox.get.invalidate({ code: data.case.code });
    },
    onError: (e) => setMsg(e.message),
  });

  const isRops = data.viewer.role === "rops";
  const summary = triageSummary(tr, locale);
  const otherLang = (l: string | null | undefined) =>
    l && l !== locale ? l : undefined;

  return (
    <section aria-labelledby="triage-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="triage-heading"
          className="flex flex-wrap items-center gap-2 text-xl font-bold"
        >
          <SparklesIcon aria-hidden="true" className="size-5" />
          {t("heading")}
          {tr?.sample && <SampleBadge />}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 max-w-full px-3 text-base whitespace-normal"
          disabled={retriage.isPending}
          onClick={() => {
            setMsg("");
            retriage.mutate({ code: data.case.code });
          }}
        >
          <RefreshCwIcon aria-hidden="true" />
          {retriage.isPending ? t("retriaging") : t("retriage")}
        </Button>
      </div>
      <p role="status" className="text-sm font-semibold">
        {msg}
      </p>
      {tr?.sample && (
        <p className="text-muted-foreground text-sm">{t("sampleNote")}</p>
      )}

      {tr?.crisis && (
        <div
          role="note"
          className="border-destructive flex gap-2 border-l-4 py-1 pl-3"
        >
          <AlertTriangleIcon
            aria-hidden="true"
            className="text-destructive mt-0.5 size-5 shrink-0"
          />
          <div>
            <p className="font-bold">{t("crisisTitle")}</p>
            <p className="text-sm">
              {tr.crisis.categories.map(crisisLabel).join(", ")}
              {tr.crisis.matched.length > 0 && (
                <>
                  {" — "}
                  {t("crisisExample")}{" "}
                  <span lang="pl">
                    „{tr.crisis.matched.slice(0, 2).join("”, „")}”
                  </span>
                </>
              )}
              . {t("crisisContact")}
            </p>
          </div>
        </div>
      )}

      {!tr ? (
        <p className="text-muted-foreground">{t("pending")}</p>
      ) : (
        <>
          {tr.source === "keywords" && (
            <div className="bg-warning-bg rounded-md p-3">
              <p className="font-bold">{t("unavailableTitle")}</p>
              <p className="text-sm">
                {t("unavailableReason", { reason: aiReason(tr.aiStatus) })}
              </p>
            </div>
          )}

          <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
            {summary && (
              <>
                <dt className="text-muted-foreground">{t("summary")}</dt>
                <dd lang={otherLang(summary.lang)}>{summary.text}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("area")}</dt>
            <dd>
              {tr.areas.length
                ? tr.areas.map((a) => L.area[a]).join(", ")
                : t("notRecognised")}
              {tr.source === "keywords" && tr.areas.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  {t("keywordsTag")}
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground">{t("urgency")}</dt>
            <dd className={tr.urgency === "high" ? "font-bold" : undefined}>
              {tr.urgency ? L.urgency[tr.urgency] : tl("unassessed")}
            </dd>
            {tr.powiatGuess && (
              <>
                <dt className="text-muted-foreground">{t("powiat")}</dt>
                <dd>
                  <span lang={otherLang("pl")}>{tr.powiatGuess}</span>{" "}
                  <span className="text-muted-foreground">
                    {t("powiatGuessNote")}
                  </span>
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("expert")}</dt>
            <dd>
              {data.suggestedExpert ? (
                <span className="flex flex-col items-start gap-2">
                  <span>
                    {data.suggestedExpert.displayName}
                    {data.suggestedExpert.title &&
                      ` — ${data.suggestedExpert.title}`}
                    {data.suggestedExpert.isSample && (
                      <>
                        {" "}
                        <SampleBadge className="ml-1" />
                      </>
                    )}
                  </span>
                  {isRops &&
                    data.case.assigneeId !== data.suggestedExpert.id && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-12 max-w-full px-3 text-base whitespace-normal"
                        disabled={assign.isPending}
                        onClick={() =>
                          assign.mutate({
                            code: data.case.code,
                            assigneeId: data.suggestedExpert!.id,
                          })
                        }
                      >
                        <UserCheckIcon aria-hidden="true" />
                        {t("assignThis")}
                      </Button>
                    )}
                </span>
              ) : (
                t("noSuggestion")
              )}
            </dd>
            <dt className="text-muted-foreground">{t("similar")}</dt>
            <dd>
              {data.similarCases.length ? (
                <ul className="flex flex-col gap-1">
                  {data.similarCases.map((s) => (
                    <li key={s.id}>
                      <Link href={caseHref(basePath, s.code)}>
                        <span className="font-mono">{s.code}</span>: {s.title}
                      </Link>{" "}
                      <span className="text-muted-foreground text-sm">
                        ({L.caseStatus[s.status]})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : data.similarHiddenCount === 0 ? (
                t("none")
              ) : null}
              {data.similarHiddenCount > 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("similarHidden", {
                    more: data.similarCases.length > 0 ? "yes" : "no",
                    count: data.similarHiddenCount,
                  })}
                </p>
              )}
            </dd>
          </dl>

          <div className="border-hairline flex flex-col gap-2 border-t pt-4">
            <label htmlFor="triage-draft" className="font-semibold">
              {t("draftLabel")}{" "}
              {tr.sample
                ? t("draftSample")
                : tr.source === "ai"
                  ? t("draftAi")
                  : tr.crisis
                    ? t("draftCrisis")
                    : t("draftKeywords")}
            </label>
            <p id="triage-draft-hint" className="text-muted-foreground text-sm">
              {t("draftHint", {
                basis: tr.crisis ? t("basisCrisis") : t("basisCards"),
              })}
            </p>
            <Textarea
              id="triage-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby="triage-draft-hint"
              rows={10}
              className="min-h-48 text-base"
            />
            <div>
              <Button
                type="button"
                className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
                disabled={!draft.trim()}
                onClick={() => onUseDraft(draft)}
              >
                {t("useDraft")}
              </Button>
            </div>
          </div>

          {tr.crisis && (
            <div>
              <h3 className="font-semibold">{t("helplineSources")}</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {CRISIS_RESOURCES.map((r) => (
                  <li key={r.phone}>
                    {r.phone} — <span lang={otherLang("pl")}>{r.name}</span>.{" "}
                    {t("helplineSource")}{" "}
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                      {t("operatorPage")}
                      <span className="sr-only"> {tk("newTab")}</span>
                    </a>
                    , {t("checked", { date: formatDate(r.verifiedAt, locale) })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-semibold">
              {tr.crisis ? t("cardsCrisis") : t("cardsCited")}
            </h3>
            {tr.cards.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noCards")}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {tr.cards.map((k) => {
                  const info = data.cardInfo[k.id];
                  const en = locale === "en";
                  const title = en && k.titleEn ? k.titleEn : k.title;
                  const translated = en && !!k.sentenceEn;
                  return (
                    <li key={k.id}>
                      <p className="font-semibold">
                        <Link
                          href={`/library/${k.slug}`}
                          lang={en && !k.titleEn ? "pl" : undefined}
                        >
                          „{title}”
                        </Link>
                      </p>
                      {k.matchedTerms && k.matchedTerms.length > 0 && (
                        <p className="text-sm">
                          {t("matchedBecause")}{" "}
                          {k.matchedTerms.slice(0, 5).map((w, i) => (
                            <span key={w}>
                              {i > 0 && ", "}„{w}”
                            </span>
                          ))}
                        </p>
                      )}
                      <blockquote
                        className="border-hairline mt-1 border-l-4 pl-3 italic"
                        lang={en && !translated ? "pl" : undefined}
                      >
                        {translated ? k.sentenceEn : k.sentence}
                      </blockquote>
                      {translated && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {t("translatedQuote")}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1 text-sm">
                        {t("source")}{" "}
                        <a
                          href={info?.sourceUrl ?? `/library/${k.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("librarySource")}
                          <span className="sr-only"> {tk("newTab")}</span>
                        </a>
                        {info?.capturedAt &&
                          `, ${t("asOf", { date: formatDate(info.capturedAt, locale) })}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
