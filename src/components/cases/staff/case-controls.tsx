"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { useLabels } from "~/i18n/use-labels";
import { CASE_STATUSES, type CaseStatus } from "~/lib/domain";
import { api, type RouterOutputs } from "~/trpc/react";
import { fmtDateTime } from "./labels";

type Data = RouterOutputs["admin"]["inbox"]["get"];

const selectClass =
  "border-input bg-background min-h-12 w-full rounded-md border px-3 text-base";

const CHANNELS = ["email", "sms", "phone", "none"] as const;
const DELIVERY = ["sent", "simulated", "skipped", "failed", "none"] as const;
const known = <T extends string>(all: readonly T[], v: string): v is T =>
  (all as readonly string[]).includes(v);

/** Status and assignment. Assigning is for ROPS; experts can move status. */
export function CaseControls({ data }: { data: Data }) {
  const t = useTranslations("admin.controls");
  const tl = useTranslations("admin.labels");
  const L = useLabels();
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
        r.changed
          ? t("statusSaved", { status: L.caseStatus[status] })
          : t("noChange"),
      );
      await refresh();
    },
    onError: (e) => setMsg(e.message),
  });
  const assignM = api.admin.inbox.assign.useMutation({
    onSuccess: async (r) => {
      setMsg(r.changed ? t("assignSaved") : t("noChange"));
      await refresh();
    },
    onError: (e) => setMsg(e.message),
  });
  const isRops = data.viewer.role === "rops";

  return (
    <section
      aria-labelledby="controls-heading"
      className="border-hairline flex flex-col gap-4 border-t pt-6"
    >
      <h2 id="controls-heading" className="text-xl font-bold">
        {t("heading")}
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
          {t("status")}
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
                {L.caseStatus[s]}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
            disabled={setStatusM.isPending || status === data.case.status}
          >
            {t("save")}
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
            {t("assignment")}
          </label>
          <div className="flex gap-2">
            <select
              id="case-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("unassigned")}</option>
              <option value="rops">{data.teamName}</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                  {p.title ? ` — ${p.title}` : ""}
                  {p.isSample ? tl("sampleSuffix") : ""}
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
              {t("assign")}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t("assignHint")}</p>
        </form>
      ) : (
        <p>{t("assignedToYou")}</p>
      )}
      <p role="status" className="text-sm font-semibold">
        {msg}
      </p>
    </section>
  );
}

/** Contact (masked in demo mode) and the delivery log. */
export function ContactAndDeliveries({ data }: { data: Data }) {
  const t = useTranslations("admin.contact");
  const tl = useTranslations("admin.labels");
  const L = useLabels();
  const locale = useLocale();
  const c = data.contact;
  return (
    <section
      aria-labelledby="contact-heading"
      className="border-hairline flex flex-col gap-3 border-t pt-6"
    >
      <h2 id="contact-heading" className="text-xl font-bold">
        {t("heading")}
      </h2>
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t("pref")}</dt>
        <dd className="font-semibold">{L.contactPref[c.pref]}</dd>
        {c.pref !== "none" && (
          <>
            <dt className="text-muted-foreground">{t("data")}</dt>
            <dd className="font-mono break-all">{c.value ?? t("none")}</dd>
          </>
        )}
      </dl>
      {c.masked && c.pref !== "none" && (
        <p className="text-muted-foreground text-sm">{t("masked")}</p>
      )}
      {!data.env.mail && (
        <p className="text-muted-foreground text-sm">{t("noMail")}</p>
      )}

      <h3 className="font-semibold">{t("log")}</h3>
      {data.deliveries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noDeliveries")}</p>
      ) : (
        <ul className="border-hairline border-t">
          {data.deliveries.map((d) => (
            <li key={d.id} className="border-hairline border-b py-2">
              <p className="text-sm">
                <span className="font-semibold">
                  {known(CHANNELS, d.channel)
                    ? tl(`channel.${d.channel}`)
                    : d.channel}
                </span>{" "}
                {t("to")} <span className="font-mono">{d.toMasked}</span> ·{" "}
                {fmtDateTime(d.createdAt, locale)}
              </p>
              <p className="text-sm">
                {known(DELIVERY, d.status)
                  ? tl(`delivery.${d.status}`)
                  : d.status}
                {d.status === "failed" && d.error ? `: ${d.error}` : ""}
              </p>
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2 text-sm underline">
                  {d.subject ?? t("content")}
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
