"use client";

import { AlertTriangleIcon, ArrowLeftIcon, LanguagesIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { SampleBadge } from "~/components/kit";
import { FeedbackSummary } from "~/components/tests/feedback-summary";
import { useLabels } from "~/i18n/use-labels";
import { api } from "~/trpc/react";
import {
  IdeaSection,
  InnovationSection,
  MatchSection,
  PlanSection,
} from "../case-modules";
import { CaseThread } from "../case-thread";
import { StatusTimeline } from "../status-timeline";
import { CaseControls, ContactAndDeliveries } from "./case-controls";
import { fmtDateTime } from "./labels";
import { StaffReply } from "./staff-reply";
import { TriagePanel } from "./triage-panel";
import { textLang } from "~/lib/text-lang";

/**
 * One case for staff (ROPS at /admin/cases/[code], an expert at
 * /expert?code=…). Left: the redacted request, match results, the thread and
 * the reply form. Right: AI triage with the editable draft, assignment,
 * status, contact and the delivery log — separated by hairlines, not boxes.
 * Polls every 5 s.
 */
export function CaseWorkspace({
  code,
  basePath,
}: {
  code: string;
  basePath: "/admin/cases" | "/expert";
}) {
  const t = useTranslations("admin.workspace");
  const L = useLabels();
  const locale = useLocale();
  const q = api.admin.inbox.get.useQuery(
    { code },
    {
      refetchInterval: 5000,
      retry: (n, err) =>
        err.data?.code !== "NOT_FOUND" &&
        err.data?.code !== "FORBIDDEN" &&
        n < 2,
    },
  );
  const utils = api.useUtils();
  const [reply, setReply] = useState("");
  const [announce, setAnnounce] = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const authorSeen = useRef<number | null>(null);

  // Announce new author messages while the case is open.
  useEffect(() => {
    if (!q.data) return;
    const n = q.data.messages.filter((m) => m.authorKind === "author").length;
    if (authorSeen.current !== null && n > authorSeen.current) {
      setAnnounce(t("newAuthorMessage"));
    }
    authorSeen.current = n;
  }, [q.data, t]);

  const back = (
    <Link
      href={basePath}
      className="inline-flex min-h-12 items-center gap-2 font-medium"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      {basePath === "/expert" ? t("backExpert") : t("backAdmin")}
    </Link>
  );

  if (q.isPending) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
        {back}
        <p role="status" className="mt-4 text-lg">
          {t("loading", { code })}
        </p>
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
        {back}
        <h1 className="mt-4 text-3xl font-bold">{t("cannotOpen")}</h1>
        <p role="alert" className="mt-2 text-lg">
          {q.error.message}
        </p>
      </div>
    );
  }

  const d = q.data;
  const c = d.case;
  const details = c.areas.length > 0 || !!c.place || (!!d.call && !d.idea);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
      {back}
      <header className="mt-2 flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-base font-bold">{c.code}</span>{" "}
          <span aria-hidden="true">·</span>{" "}
          <span>{L.caseKind[c.kind]}</span>{" "}
          <span aria-hidden="true">·</span>{" "}
          <span className="font-semibold">{L.caseStatus[c.status]}</span>
          {c.urgency && (
            <>
              {" "}
              <span aria-hidden="true">·</span>{" "}
              <span
                className={
                  c.urgency === "high"
                    ? "text-destructive inline-flex items-center gap-1 font-bold"
                    : undefined
                }
              >
                {c.urgency === "high" && (
                  <AlertTriangleIcon aria-hidden="true" className="size-4" />
                )}
                {t("urgency", { level: L.urgency[c.urgency] })}
              </span>
            </>
          )}
          {c.isSample && (
            <>
              {" "}
              <SampleBadge />
            </>
          )}
        </p>
        <h1 className="text-3xl font-bold break-words">
          <span lang={textLang(c.title)}>{c.title}</span>
        </h1>
        <p className="text-muted-foreground">
          {t("created", { date: fmtDateTime(c.createdAt, locale) })} ·{" "}
          {L.authorRole[c.authorRole]}
          {c.onBehalf && ` · ${t("onBehalf")}`}
        </p>
        {c.locale === "en" && (
          <p className="flex items-start gap-2 font-semibold">
            <LanguagesIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            {t("englishAuthor")}
          </p>
        )}
        {c.isSample && (
          <p className="text-muted-foreground text-sm">{t("sampleNote")}</p>
        )}
      </header>
      <p aria-live="polite" role="status" className="sr-only">
        {announce}
      </p>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-8">
          {d.match && <MatchSection match={d.match} />}

          {d.plan ? (
            <PlanSection plan={d.plan} code={c.code} />
          ) : d.idea ? (
            <IdeaSection
              idea={d.idea}
              call={d.call}
              code={c.code}
              viewer="staff"
            />
          ) : (
            <section aria-labelledby="request-heading">
              <h2 id="request-heading" className="text-xl font-bold">
                {t("request")}
              </h2>
              <p className="mt-2 text-lg whitespace-pre-wrap" lang={textLang(c.body)}>{c.body}</p>
              <p className="text-muted-foreground mt-3 text-sm">
                {t("redacted")}
              </p>
            </section>
          )}

          {details && (
            <dl className="border-hairline grid gap-x-3 gap-y-1 border-t pt-4 text-sm sm:grid-cols-[auto_1fr]">
              {c.areas.length > 0 && (
                <>
                  <dt className="text-muted-foreground">{t("area")}</dt>
                  <dd>{c.areas.map((a) => L.area[a]).join(", ")}</dd>
                </>
              )}
              {c.place && (
                <>
                  <dt className="text-muted-foreground">{t("place")}</dt>
                  <dd>{c.place}</dd>
                </>
              )}
              {d.call && !d.idea && (
                <>
                  <dt className="text-muted-foreground">{t("call")}</dt>
                  <dd>{d.call.name}</dd>
                </>
              )}
            </dl>
          )}

          {d.innovation && (
            <InnovationSection
              kind={c.kind}
              innovation={d.innovation}
              rating={d.rating}
            />
          )}
          {d.innovation && (c.kind === "test" || c.kind === "feedback") && (
            <div className="border-hairline border-t pt-4">
              <FeedbackSummary innovationId={d.innovation.id} />
            </div>
          )}

          <section aria-labelledby="thread-heading">
            <h2 id="thread-heading" className="text-xl font-bold">
              {t("thread")}
            </h2>
            <div className="mt-3">
              <CaseThread viewer="staff" messages={d.messages} />
            </div>
          </section>

          <StaffReply
            data={d}
            body={reply}
            setBody={setReply}
            inputRef={replyRef}
            onSent={async (id) => {
              await utils.admin.inbox.get.invalidate({ code });
              await q.refetch();
              document.getElementById(`msg-${id}`)?.focus();
            }}
          />
        </div>

        <aside
          aria-label={t("aside")}
          className="flex min-w-0 flex-col gap-8"
        >
          <TriagePanel
            data={d}
            basePath={basePath}
            onUseDraft={(text) => {
              setReply(text);
              setAnnounce(t("draftInserted"));
              replyRef.current?.focus();
              replyRef.current?.scrollIntoView({ block: "center" });
            }}
          />
          <CaseControls data={d} />
          <ContactAndDeliveries data={d} />
          <section
            aria-labelledby="ws-timeline-heading"
            className="border-hairline border-t pt-6"
          >
            <h2 id="ws-timeline-heading" className="text-xl font-bold">
              {t("timeline")}
            </h2>
            <StatusTimeline
              steps={d.timeline}
              className="mt-3 lg:grid-flow-row lg:grid-cols-1"
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
