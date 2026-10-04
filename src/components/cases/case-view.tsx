"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { PrinterIcon, SendIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useEasyMode } from "~/components/kit";
import { api } from "~/trpc/react";
import { CaseCode } from "./case-code";
import { IdeaSection, InnovationSection, PlanSection } from "./case-modules";
import { CaseThread } from "./case-thread";
import { fmtDate } from "./format";
import { markSeen, readMyCases, rememberCase } from "./my-cases";
import { StatusTimeline } from "./status-timeline";

/** Errors that will not go away by asking again (and must not count as more guesses). */
const FINAL = new Set(["NOT_FOUND", "TOO_MANY_REQUESTS", "FORBIDDEN"]);

/**
 * The author's case page: code, status, timeline, the two-way thread and a
 * reply box. Polls every 5 s (stops on an error, so a wrong code is counted
 * once) and announces a new reply through aria-live. Reading needs only the
 * code; replying needs the private-link token — from the URL or saved on this
 * device.
 */
export function CaseView({ code, token }: { code: string; token?: string }) {
  const t = useTranslations("cases.view");
  const tc = useTranslations("cases");
  const locale = useLocale();
  // The private link opened on this device before (saved in localStorage).
  const [savedToken, setSavedToken] = useState<string | undefined>();
  useEffect(() => {
    if (!token) setSavedToken(readMyCases().find((c) => c.code === code)?.token);
  }, [code, token]);
  const key = token ?? savedToken;

  const q = api.cases.get.useQuery(
    { code, token: key },
    {
      refetchInterval: (query) =>
        query.state.status === "error" ? false : 5000,
      retry: (n, err) => !FINAL.has(err.data?.code ?? "") && n < 2,
      placeholderData: keepPreviousData,
    },
  );
  const easy = useEasyMode();
  const [announce, setAnnounce] = useState("");
  const staffSeen = useRef<number | null>(null);
  /** What this device last saved for the case ("" = the code alone). */
  const remembered = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef(false);

  // Move focus to the page heading once it is on screen (case or error).
  useEffect(() => {
    if (q.isPending || focused.current) return;
    focused.current = true;
    heading.current?.focus();
  }, [q.isPending]);

  useEffect(() => {
    if (!q.data) return;
    const save = q.data.privateLink ? (key ?? "") : "";
    if (remembered.current !== save) {
      remembered.current = save;
      rememberCase(code, save || undefined);
    }
    const staff = q.data.messages.filter((m) => m.from === "staff");
    if (staffSeen.current !== null && staff.length > staffSeen.current) {
      const last = staff[staff.length - 1];
      setAnnounce(
        t("newReply", {
          from:
            last?.authorKind === "expert" && last.authorName
              ? last.authorName
              : tc("thread.residentTeam"),
        }),
      );
    }
    staffSeen.current = staff.length;
    markSeen(code);
  }, [q.data, code, key, t, tc]);

  if (q.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 [overflow-wrap:anywhere]">
        <p role="status" className="text-lg">
          {t("loading", { code })}
        </p>
      </div>
    );
  }
  if (q.error && !q.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 [overflow-wrap:anywhere]">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold">
          {t("cannotOpen")}
        </h1>
        <p role="alert" className="mt-3 text-lg">
          {FINAL.has(q.error.data?.code ?? "")
            ? q.error.message
            : t("genericError")}
        </p>
        <Button asChild className="mt-6 min-h-12 px-5 text-base">
          <Link href="/case">{t("tryAgain")}</Link>
        </Button>
      </div>
    );
  }

  const c = q.data;
  const ownToken = c.privateLink ? key : undefined;
  const otherLang = c.locale !== locale ? c.locale : undefined;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 [overflow-wrap:anywhere] print:max-w-none print:p-0">
      {easy && (
        <p
          className="border-hairline bg-surface mb-4 rounded-md border p-3"
          data-no-print
        >
          {t.rich("noEasy", {
            link: (chunks) => <Link href="/easy-read">{chunks}</Link>,
          })}
        </p>
      )}
      <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {t("eyebrow")}
      </p>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-1 text-3xl font-bold break-words"
      >
        {c.title}
      </h1>
      <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t("kind")}</dt>
        <dd className="font-semibold">{tc(`kind.${c.kind}`)}</dd>
        <dt className="text-muted-foreground">{t("status")}</dt>
        <dd className="font-semibold">{tc(`status.${c.status}`)}</dd>
        <dt className="text-muted-foreground">{t("created")}</dt>
        <dd>{fmtDate(c.createdAt, locale)}</dd>
      </dl>

      <div className="border-hairline mt-6 rounded-lg border p-5">
        <CaseCode code={c.code} />
        <div className="mt-4 flex flex-wrap gap-3" data-no-print>
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
          >
            <Link
              href={`/case/${c.code}/print${ownToken ? `?t=${encodeURIComponent(ownToken)}` : ""}`}
            >
              <PrinterIcon aria-hidden="true" />
              {t("printSheet")}
            </Link>
          </Button>
        </div>
      </div>

      <section aria-labelledby="timeline-heading" className="mt-8">
        <h2 id="timeline-heading" className="text-2xl font-bold">
          {t("stages")}
        </h2>
        <StatusTimeline steps={c.timeline} className="mt-3" />
      </section>

      {c.plan && (
        <div className="mt-8">
          <PlanSection plan={c.plan} code={c.code} contentLang={otherLang} />
        </div>
      )}
      {c.idea && (
        <div className="mt-8">
          <IdeaSection
            idea={c.idea}
            call={c.call}
            code={c.code}
            viewer="author"
            token={ownToken}
          />
        </div>
      )}
      {c.innovation && !c.plan && (
        <div className="mt-8">
          <InnovationSection
            kind={c.kind}
            innovation={c.innovation}
            rating={c.rating}
          />
        </div>
      )}

      {!c.plan && !c.idea && (
        <details className="border-hairline mt-8 rounded-md border p-4">
          <summary className="min-h-12 cursor-pointer py-2 font-semibold">
            {t("yourRequest")}
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{c.body}</p>
          <p className="text-muted-foreground mt-3 text-sm">
            {t("redacted")}
          </p>
        </details>
      )}

      <section aria-labelledby="thread-heading" className="mt-8">
        <h2 id="thread-heading" className="text-2xl font-bold">
          {t("thread")}
        </h2>
        <p className="text-muted-foreground mt-1" data-no-print>
          {t("polling")}
        </p>
        <div className="mt-4">
          <CaseThread
            viewer="author"
            readAloud
            messages={c.messages.map((m) => ({ ...m, visibleToAuthor: true }))}
          />
        </div>
        <p aria-live="polite" role="status" className="sr-only">
          {announce}
        </p>
      </section>

      <AuthorReply code={c.code} token={ownToken} onSent={() => q.refetch()} />
    </div>
  );
}

function AuthorReply({
  code,
  token,
  onSent,
}: {
  code: string;
  /** The private-link token; without it the author can only read. */
  token?: string;
  onSent: () => Promise<unknown>;
}) {
  const t = useTranslations("cases.reply");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const reply = api.cases.reply.useMutation();

  return (
    <section
      aria-labelledby="reply-heading"
      className="border-hairline mt-8 rounded-lg border p-5"
      data-no-print
    >
      <h2 id="reply-heading" className="text-2xl font-bold">
        {t("heading")}
      </h2>
      {!token ? (
        <div className="mt-3 flex flex-col gap-2">
          <p>{t("needLink")}</p>
          <p className="text-muted-foreground">{t("needLinkWhere")}</p>
        </div>
      ) : (
        <form
          noValidate
          className="mt-3 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setDone("");
            if (body.trim().length < 2) {
              setError(t("tooShort"));
              ref.current?.focus();
              return;
            }
            try {
              const r = await reply.mutateAsync({ code, token, body });
              setBody("");
              setError("");
              setDone(t("sent"));
              await onSent();
              document.getElementById(`msg-${r.id}`)?.focus();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "";
              // Validation errors arrive as JSON; show a plain sentence instead.
              setError(
                msg && !msg.startsWith("[") && !msg.startsWith("{")
                  ? msg
                  : t("failed"),
              );
              ref.current?.focus();
            }
          }}
        >
          <label htmlFor="author-reply" className="font-semibold">
            {t("label")}
          </label>
          <p id="author-reply-hint" className="text-muted-foreground text-sm">
            {t("hint")}
          </p>
          <Textarea
            ref={ref}
            id="author-reply"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={4000}
            aria-describedby={
              error ? "author-reply-hint author-reply-error" : "author-reply-hint"
            }
            aria-invalid={error ? true : undefined}
            className="min-h-32 text-base"
          />
          {error && (
            <p
              id="author-reply-error"
              role="alert"
              className="text-destructive font-semibold"
            >
              {error}
            </p>
          )}
          <div>
            <Button
              type="submit"
              disabled={reply.isPending}
              className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
            >
              <SendIcon aria-hidden="true" />
              {reply.isPending ? t("sending") : t("send")}
            </Button>
          </div>
          <p role="status" className="font-semibold">
            {done}
          </p>
        </form>
      )}
    </section>
  );
}
