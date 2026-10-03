"use client";

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  CASE_STATUS_LABEL,
  CASE_STATUSES,
  CONTACT_PREF_LABEL,
  type CaseStatus,
} from "~/lib/domain";
import { api, type RouterOutputs } from "~/trpc/react";
import { fmtDateTime } from "../format";
import { CHANNEL_LABEL, DELIVERY_STATUS_LABEL } from "./labels";

type Data = RouterOutputs["admin"]["inbox"]["get"];

const selectClass =
  "border-input bg-background min-h-12 w-full rounded-md border px-3 text-base";

/** Status and assignment. Assigning is for ROPS; experts can move status. */
export function CaseControls({ data }: { data: Data }) {
  const utils = api.useUtils();
  const code = data.case.code;
  const [status, setStatus] = useState<CaseStatus>(data.case.status);
  const [assignee, setAssignee] = useState(data.case.assigneeId ?? "");
  const [msg, setMsg] = useState("");
  useEffect(() => setStatus(data.case.status), [data.case.status]);
  useEffect(
    () => setAssignee(data.case.assigneeId ?? ""),
    [data.case.assigneeId],
  );

  const refresh = () => utils.admin.inbox.get.invalidate({ code });
  const setStatusM = api.admin.inbox.setStatus.useMutation({
    onSuccess: async (r) => {
      setMsg(
        r.changed ? `Status: ${CASE_STATUS_LABEL[status]}.` : "Bez zmian.",
      );
      await refresh();
    },
    onError: (e) => setMsg(e.message),
  });
  const assignM = api.admin.inbox.assign.useMutation({
    onSuccess: async (r) => {
      setMsg(r.changed ? "Przydział zapisany." : "Bez zmian.");
      await refresh();
    },
    onError: (e) => setMsg(e.message),
  });
  const isRops = data.viewer.role === "rops";

  return (
    <section
      aria-labelledby="controls-heading"
      className="border-hairline flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 id="controls-heading" className="text-xl font-bold">
        Prowadzenie sprawy
      </h2>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          setStatusM.mutate({ code, status });
        }}
      >
        <label htmlFor="case-status" className="font-semibold">
          Status
        </label>
        <div className="flex gap-2">
          <select
            id="case-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus)}
            className={selectClass}
          >
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
            disabled={setStatusM.isPending || status === data.case.status}
          >
            Zapisz
          </Button>
        </div>
      </form>

      {isRops ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg("");
            assignM.mutate({ code, assigneeId: assignee || null });
          }}
        >
          <label htmlFor="case-assignee" className="font-semibold">
            Przydział
          </label>
          <div className="flex gap-2">
            <select
              id="case-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className={selectClass}
            >
              <option value="">Nieprzydzielona</option>
              <option value="rops">Zespół Hubu ROPS</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                  {p.title ? ` — ${p.title}` : ""}
                  {p.isSample ? " (przykładowe)" : ""}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              variant="outline"
              className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
              disabled={
                assignM.isPending || assignee === (data.case.assigneeId ?? "")
              }
            >
              Przydziel
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Ekspert dostanie powiadomienie i zobaczy sprawę w zakładce „Moje
            sprawy”.
          </p>
        </form>
      ) : (
        <p>Sprawa jest przydzielona do Ciebie.</p>
      )}
      <p role="status" className="text-sm font-semibold">
        {msg}
      </p>
    </section>
  );
}

/** Contact (masked in demo mode) and the delivery log. */
export function ContactAndDeliveries({ data }: { data: Data }) {
  const c = data.contact;
  return (
    <section
      aria-labelledby="contact-heading"
      className="border-hairline flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id="contact-heading" className="text-xl font-bold">
        Kontakt i wysyłki
      </h2>
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Preferowany kontakt</dt>
        <dd className="font-semibold">{CONTACT_PREF_LABEL[c.pref]}</dd>
        {c.pref !== "none" && (
          <>
            <dt className="text-muted-foreground">Dane</dt>
            <dd className="font-mono break-all">{c.value ?? "brak"}</dd>
          </>
        )}
      </dl>
      {c.masked && c.pref !== "none" && (
        <p className="text-muted-foreground text-sm">
          W wersji demonstracyjnej dane kontaktowe są zamaskowane. Są
          zaszyfrowane w bazie i odszyfrowywane tylko dla pracowników.
        </p>
      )}
      {!data.env.mail && (
        <p className="text-muted-foreground text-sm">
          Poczta nie jest skonfigurowana w tym środowisku: e-maile są zapisywane
          w dzienniku, ale nie wychodzą.
        </p>
      )}

      <h3 className="font-semibold">Dziennik wysyłek</h3>
      {data.deliveries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Brak wysyłek.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.deliveries.map((d) => (
            <li key={d.id} className="border-hairline rounded-md border p-2">
              <p className="text-sm">
                <span className="font-semibold">
                  {CHANNEL_LABEL[d.channel] ?? d.channel}
                </span>{" "}
                do <span className="font-mono">{d.toMasked}</span> ·{" "}
                {fmtDateTime(d.createdAt)}
              </p>
              <p className="text-sm">
                {DELIVERY_STATUS_LABEL[d.status] ?? d.status}
                {d.status === "failed" && d.error ? `: ${d.error}` : ""}
              </p>
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2 text-sm underline">
                  {d.subject ?? "Treść"}
                </summary>
                <pre className="bg-surface mt-1 overflow-x-auto rounded p-2 font-sans text-sm whitespace-pre-wrap">
                  {d.body}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
