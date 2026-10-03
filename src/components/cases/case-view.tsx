"use client";

import { PrinterIcon, QrCodeIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { CASE_KIND_LABEL } from "~/lib/domain";
import { api } from "~/trpc/react";
import { CaseCode } from "./case-code";
import { CaseThread } from "./case-thread";
import { fmtDate } from "./format";
import { markSeen, rememberCase } from "./my-cases";
import { STEP_LABEL, StatusTimeline } from "./status-timeline";

/**
 * The author's case page: code, status, timeline, the two-way thread and a
 * reply box. Polls every 5 s and announces a new reply through aria-live.
 */
export function CaseView({ code, token }: { code: string; token?: string }) {
  const q = api.cases.get.useQuery(
    { code, token },
    {
      refetchInterval: 5000,
      retry: (n, err) => err.data?.code !== "NOT_FOUND" && n < 2,
    },
  );
  const [announce, setAnnounce] = useState("");
  const staffSeen = useRef<number | null>(null);
  const remembered = useRef(false);

  useEffect(() => {
    if (!q.data) return;
    if (!remembered.current) {
      remembered.current = true;
      rememberCase(code, q.data.privateLink ? token : undefined);
    }
    const staff = q.data.messages.filter((m) => m.from === "staff");
    if (staffSeen.current !== null && staff.length > staffSeen.current) {
      const last = staff[staff.length - 1];
      setAnnounce(
        `Nowa odpowiedź od: ${last?.authorName ?? "Zespół Hubu ROPS"}.`,
      );
    }
    staffSeen.current = staff.length;
    markSeen(code);
  }, [q.data, code, token]);

  if (q.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p role="status" className="text-lg">
          Wczytuję sprawę {code}…
        </p>
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Nie możemy otworzyć tej sprawy</h1>
        <p role="alert" className="mt-3 text-lg">
          {q.error.data?.code === "NOT_FOUND" ||
          q.error.data?.code === "TOO_MANY_REQUESTS"
            ? q.error.message
            : "Wystąpił błąd. Spróbuj odświeżyć stronę za chwilę."}
        </p>
        <Button asChild className="mt-6 min-h-12 px-5 text-base">
          <Link href="/case">Wpisz kod jeszcze raz</Link>
        </Button>
      </div>
    );
  }

  const c = q.data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        Moja sprawa
      </p>
      <h1 className="mt-1 text-3xl font-bold break-words">{c.title}</h1>
      <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Rodzaj</dt>
        <dd className="font-semibold">{CASE_KIND_LABEL[c.kind]}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="font-semibold">{STEP_LABEL[c.status]}</dd>
        <dt className="text-muted-foreground">Zgłoszona</dt>
        <dd>{fmtDate(c.createdAt)}</dd>
      </dl>

      <div className="border-hairline mt-6 rounded-lg border p-5">
        <CaseCode code={c.code} />
        <div className="mt-4 flex flex-wrap gap-3" data-no-print>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 px-4 text-base"
            onClick={() => window.print()}
          >
            <PrinterIcon aria-hidden="true" />
            Drukuj
          </Button>
          <Button asChild variant="outline" className="min-h-12 px-4 text-base">
            <Link href={`/case/${c.code}/print`}>
              <QrCodeIcon aria-hidden="true" />
              Kartka z kodem QR (A4)
            </Link>
          </Button>
        </div>
      </div>

      <section aria-labelledby="timeline-heading" className="mt-8">
        <h2 id="timeline-heading" className="text-2xl font-bold">
          Etapy sprawy
        </h2>
        <StatusTimeline steps={c.timeline} className="mt-3" />
      </section>

      <details className="border-hairline mt-8 rounded-md border p-4">
        <summary className="min-h-12 cursor-pointer py-2 font-semibold">
          Twoje zgłoszenie
        </summary>
        <p className="mt-2 whitespace-pre-wrap">{c.body}</p>
        <p className="text-muted-foreground mt-3 text-sm">
          Numery telefonów, adresy e-mail i numery PESEL ukryliśmy, zanim
          zapisaliśmy zgłoszenie.
        </p>
      </details>

      <section aria-labelledby="thread-heading" className="mt-8">
        <h2 id="thread-heading" className="text-2xl font-bold">
          Rozmowa z Zespołem Hubu
        </h2>
        <p className="text-muted-foreground mt-1" data-no-print>
          Strona sprawdza nowe odpowiedzi co kilka sekund.
        </p>
        <div className="mt-4">
          <CaseThread
            viewer="author"
            messages={c.messages.map((m) => ({ ...m, visibleToAuthor: true }))}
          />
        </div>
        <p aria-live="polite" role="status" className="sr-only">
          {announce}
        </p>
      </section>

      <AuthorReply code={c.code} onSent={() => q.refetch()} />
    </div>
  );
}

function AuthorReply({
  code,
  onSent,
}: {
  code: string;
  onSent: () => Promise<unknown>;
}) {
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
        Napisz do Zespołu Hubu
      </h2>
      <form
        noValidate
        className="mt-3 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setDone("");
          if (body.trim().length < 2) {
            setError("Napisz wiadomość — co najmniej 2 znaki.");
            ref.current?.focus();
            return;
          }
          try {
            const r = await reply.mutateAsync({ code, body });
            setBody("");
            setError("");
            setDone("Wiadomość wysłana. Zespół Hubu dostał powiadomienie.");
            await onSent();
            document.getElementById(`msg-${r.id}`)?.focus();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
            );
            ref.current?.focus();
          }
        }}
      >
        <label htmlFor="author-reply" className="font-semibold">
          Twoja wiadomość
        </label>
        <p id="author-reply-hint" className="text-muted-foreground text-sm">
          Nie wpisuj numeru PESEL ani adresu. Numery telefonów i adresy e-mail
          ukryjemy automatycznie.
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
          <p id="author-reply-error" role="alert" className="text-destructive font-semibold">
            {error}
          </p>
        )}
        <div>
          <Button
            type="submit"
            disabled={reply.isPending}
            className="min-h-12 px-5 text-base"
          >
            <SendIcon aria-hidden="true" />
            {reply.isPending ? "Wysyłam…" : "Wyślij wiadomość"}
          </Button>
        </div>
        <p role="status" className="font-semibold">
          {done}
        </p>
      </form>
    </section>
  );
}
