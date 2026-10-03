"use client";

import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  AUTHOR_ROLE_LABEL,
  CASE_KIND_LABEL,
  CASE_STATUS_LABEL,
  MAPA_AREA_LABEL,
  URGENCY_LABEL,
} from "~/lib/domain";
import { api } from "~/trpc/react";
import { FeedbackSummary } from "~/components/tests/feedback-summary";
import {
  IdeaSection,
  InnovationSection,
  MatchSection,
  PlanSection,
} from "../case-modules";
import { CaseThread } from "../case-thread";
import { fmtDateTime } from "../format";
import { StatusTimeline } from "../status-timeline";
import { CaseControls, ContactAndDeliveries } from "./case-controls";
import { StaffReply } from "./staff-reply";
import { TriagePanel } from "./triage-panel";

/**
 * One case for staff (ROPS at /admin/cases/[code], an expert at
 * /expert?code=…). Left: the redacted request, match results, the thread and
 * the reply form. Right: AI triage with the editable draft, assignment,
 * status, contact and the delivery log. Polls every 5 s.
 */
export function CaseWorkspace({
  code,
  basePath,
}: {
  code: string;
  basePath: "/admin/cases" | "/expert";
}) {
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
      setAnnounce("Nowa wiadomość od autora sprawy.");
    }
    authorSeen.current = n;
  }, [q.data]);

  const back = (
    <Link
      href={basePath}
      className="inline-flex min-h-12 items-center gap-2 font-medium"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      {basePath === "/expert" ? "Wróć do moich spraw" : "Wróć do skrzynki"}
    </Link>
  );

  if (q.isPending) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        {back}
        <p role="status" className="mt-4 text-lg">
          Wczytuję sprawę {code}…
        </p>
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        {back}
        <h1 className="mt-4 text-3xl font-bold">Nie można otworzyć sprawy</h1>
        <p role="alert" className="mt-2 text-lg">
          {q.error.message}
        </p>
      </div>
    );
  }

  const d = q.data;
  const c = d.case;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {back}
      <header className="mt-2 flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-base font-bold">{c.code}</span>
          <span aria-hidden="true">·</span>
          <span>{CASE_KIND_LABEL[c.kind]}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold">{CASE_STATUS_LABEL[c.status]}</span>
          {c.urgency && (
            <>
              <span aria-hidden="true">·</span>
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
                Pilność: {URGENCY_LABEL[c.urgency]}
              </span>
            </>
          )}
          {c.isSample && (
            <span className="border-hairline rounded border px-2">
              przykładowe
            </span>
          )}
        </p>
        <h1 className="text-3xl font-bold break-words">{c.title}</h1>
        <p className="text-muted-foreground">
          Zgłoszona {fmtDateTime(c.createdAt)} ·{" "}
          {AUTHOR_ROLE_LABEL[c.authorRole]}
          {c.onBehalf && " · w imieniu innej osoby"}
        </p>
      </header>
      <p aria-live="polite" role="status" className="sr-only">
        {announce}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-6">
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
            <section
              aria-labelledby="request-heading"
              className="border-hairline rounded-lg border p-4"
            >
              <h2 id="request-heading" className="text-xl font-bold">
                Zgłoszenie
              </h2>
              <p className="mt-2 whitespace-pre-wrap">{c.body}</p>
              <p className="text-muted-foreground mt-3 text-sm">
                Tekst po automatycznym usunięciu danych osobowych (telefony,
                e-maile, PESEL, adresy).
              </p>
            </section>
          )}

          {(c.areas.length > 0 || !!c.gminaTeryt || (!!d.call && !d.idea)) && (
            <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              {c.areas.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Obszar</dt>
                  <dd>{c.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")}</dd>
                </>
              )}
              {c.gminaTeryt && (
                <>
                  <dt className="text-muted-foreground">Gmina (TERYT)</dt>
                  <dd className="font-mono">{c.gminaTeryt}</dd>
                </>
              )}
              {d.call && !d.idea && (
                <>
                  <dt className="text-muted-foreground">Nabór</dt>
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
            <div className="border-hairline rounded-lg border p-4">
              <FeedbackSummary innovationId={d.innovation.id} />
            </div>
          )}

          <section aria-labelledby="thread-heading">
            <h2 id="thread-heading" className="text-xl font-bold">
              Wątek
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
          aria-label="Ocena i prowadzenie sprawy"
          className="flex min-w-0 flex-col gap-6"
        >
          <TriagePanel
            data={d}
            basePath={basePath}
            onUseDraft={(text) => {
              setReply(text);
              setAnnounce("Szkic wstawiony do pola odpowiedzi.");
              replyRef.current?.focus();
              replyRef.current?.scrollIntoView({ block: "center" });
            }}
          />
          <CaseControls data={d} />
          <ContactAndDeliveries data={d} />
          <section
            aria-labelledby="ws-timeline-heading"
            className="border-hairline rounded-lg border p-4"
          >
            <h2 id="ws-timeline-heading" className="text-xl font-bold">
              Etapy widoczne dla autora
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
