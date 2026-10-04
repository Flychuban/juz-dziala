"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  MegaphoneIcon,
  SaveIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useLabels } from "~/i18n/use-labels";
import {
  CALL_STATUSES,
  MAPA_AREAS,
  type CallStatus,
  type MapaArea,
} from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { fieldErrorsOf, useErrorText } from "./error-text";

export type CallForm = {
  id: string | null;
  name: string;
  program: string;
  operator: string;
  amountMax: string;
  amountAvg: string;
  windowFrom: string;
  windowTo: string;
  status: CallStatus;
  eligibility: string;
  areas: MapaArea[];
  sourceUrl: string;
  notes: string;
};


const toNum = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? null : Math.round(n);
};

/**
 * Calls editor. „Zapisz" changes the call at once without telling anyone;
 * „Zapisz i opublikuj zmiany" also notifies subscribers of „nabory" and of
 * the call's areas, then lists the deliveries.
 */
export function CallEditor({
  initial,
  subscribers,
}: {
  initial: CallForm;
  subscribers: Record<string, number>;
}) {
  const t = useTranslations("admin.callEditor");
  const tc = useTranslations("admin.calls");
  const L = useLabels();
  const errorText = useErrorText();
  // Calls are written in Polish; the English UI marks the fields as Polish.
  const pl = useLocale() === "en" ? "pl" : undefined;
  /** What happened to one notice, in words. Demo mode simulates sending. */
  const deliveryLabel = (channel: "email" | "sms", status: string) =>
    status === "sent"
      ? t("delivery.sent")
      : status === "failed"
        ? t("delivery.failed")
        : status === "simulated"
          ? channel === "email"
            ? t("delivery.simulatedEmail")
            : t("delivery.simulatedSms")
          : status === "skipped"
            ? t("delivery.skipped")
            : status;
  const router = useRouter();
  const [f, setF] = useState<CallForm>(initial);
  const save = api.admin.calls.save.useMutation();
  const publish = api.admin.calls.publish.useMutation();
  const busy = save.isPending || publish.isPending;
  const error = save.error ?? publish.error;

  const set = <K extends keyof CallForm>(k: K, v: CallForm[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const reach =
    (subscribers.calls ?? 0) +
    f.areas.reduce((n, a) => n + (subscribers[`area:${a}`] ?? 0), 0);

  async function submit(andPublish: boolean) {
    if (busy) return;
    publish.reset();
    const saved = await save
      .mutateAsync({
        id: f.id,
        input: {
          name: f.name,
          program: f.program || null,
          operator: f.operator || null,
          amountMax: toNum(f.amountMax),
          amountAvg: toNum(f.amountAvg),
          windowFrom: f.windowFrom || null,
          windowTo: f.windowTo || null,
          status: f.status,
          eligibility: f.eligibility
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          areas: f.areas,
          sourceUrl: f.sourceUrl || null,
          notes: f.notes || null,
        },
      })
      .catch(() => null);
    if (!saved) return;
    if (andPublish)
      await publish.mutateAsync({ id: saved.id }).catch(() => null);
    if (saved.created) router.push(`/admin/calls/${saved.id}?saved=1`);
    else router.refresh();
  }

  const fieldErrors = fieldErrorsOf(error, errorText);

  const text = (
    k: keyof CallForm,
    label: string,
    hint?: string,
    type = "text",
  ) => (
    <div>
      <label htmlFor={`c-${k}`} className="block font-bold">
        {label}
      </label>
      {hint ? (
        <p
          id={`c-${k}-hint`}
          className="text-foreground/85 mt-1 text-[0.9375rem]"
        >
          {hint}
        </p>
      ) : null}
      <Input
        id={`c-${k}`}
        lang={type === "text" ? pl : undefined}
        type={type}
        value={f[k] as string}
        onChange={(e) => set(k, e.target.value as never)}
        aria-describedby={hint ? `c-${k}-hint` : undefined}
        inputMode={type === "number" ? "numeric" : undefined}
        className="mt-2"
      />
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      className="space-y-8"
    >
      <div>
        <label htmlFor="c-name" className="block text-lg font-bold">
          {t("name")}
        </label>
        <Textarea
          id="c-name"
          lang={pl}
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          className="mt-2 min-h-20"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {text("program", t("program"), t("programHint"))}
        {text("operator", t("operator"))}
      </div>

      <fieldset>
        <legend className="text-lg font-bold">{t("status")}</legend>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CALL_STATUSES.map((s) => (
            <li key={s}>
              <label
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 font-semibold",
                  f.status === s ? "border-primary bg-accent" : "border-input",
                )}
              >
                <input
                  type="radio"
                  name="status"
                  checked={f.status === s}
                  onChange={() => set("status", s)}
                  className="size-5 accent-[var(--primary)]"
                />
                {L.callStatus[s]}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {text("windowFrom", t("windowFrom"), undefined, "date")}
        {text("windowTo", t("windowTo"), undefined, "date")}
        {text("amountMax", t("amountMax"), undefined, "number")}
        {text("amountAvg", t("amountAvg"), undefined, "number")}
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <label htmlFor="c-eligibility" className="block font-bold">
            {t("eligibility")}
          </label>
          <p
            id="c-eligibility-hint"
            className="text-foreground/85 mt-1 text-[0.9375rem]"
          >
            {t("eligibilityHint")}
          </p>
          <Textarea
            id="c-eligibility"
            lang={pl}
            value={f.eligibility}
            onChange={(e) => set("eligibility", e.target.value)}
            aria-describedby="c-eligibility-hint"
            className="mt-2 min-h-40"
          />
        </div>
        <fieldset>
          <legend className="font-bold">{t("areas")}</legend>
          <ul className="mt-2 space-y-1">
            {MAPA_AREAS.map((a) => (
              <li key={a}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={f.areas.includes(a)}
                    onChange={() =>
                      set(
                        "areas",
                        f.areas.includes(a)
                          ? f.areas.filter((x) => x !== a)
                          : [...f.areas, a],
                      )
                    }
                    className="size-5 accent-[var(--primary)]"
                  />
                  {L.area[a]}
                  {subscribers[`area:${a}`] ? (
                    <span className="text-muted-foreground tabular text-sm">
                      {t("subscribers", { count: subscribers[`area:${a}`]! })}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {text("sourceUrl", t("sourceUrl"), t("sourceUrlHint"), "url")}
        <div>
          <label htmlFor="c-notes" className="block font-bold">
            {t("notes")}
          </label>
          <Textarea
            id="c-notes"
            lang={pl}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="mt-2 min-h-24"
          />
        </div>
      </div>

      <div aria-live="polite" className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{t("notSaved")}</AlertTitle>
            <AlertDescription>
              {fieldErrors.length ? (
                <ul className="list-disc pl-5">
                  {fieldErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p>{error.message}</p>
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        {save.data && !publish.data && !save.data.created ? (
          <Alert variant="success" role="status">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>{t("saved")}</AlertTitle>
            <AlertDescription>{t("savedHint")}</AlertDescription>
          </Alert>
        ) : null}
        {publish.data ? (
          <Alert variant="success" role="status">
            <MegaphoneIcon aria-hidden="true" />
            <AlertTitle>
              {publish.data.kind === "call.published"
                ? t("published")
                : t("changesPublished")}{" "}
              {t("notified", { count: publish.data.deliveries.length })}
            </AlertTitle>
            <AlertDescription>
              <p>{t("subject", { subject: publish.data.subject })}</p>

              {publish.data.deliveries.length ? (
                <ul className="mt-2 space-y-1">
                  {publish.data.deliveries.map((d, i) => (
                    <li key={i} className="tabular">
                      {d.channel === "sms" ? tc("sms") : tc("email")} ·{" "}
                      {d.toMasked} ·{" "}
                      {deliveryLabel(d.channel, d.status)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("nobodySubscribed")}</p>
              )}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="border-hairline flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="submit" variant="secondary" size="lg" disabled={busy}>
          <SaveIcon aria-hidden="true" />
          {save.isPending && !publish.isPending ? t("saving") : t("save")}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={() => void submit(true)}
        >
          <MegaphoneIcon aria-hidden="true" />
          {publish.isPending ? t("publishing") : t("publish")}
        </Button>
        <p className="text-foreground/85 tabular text-[0.9375rem]">
          {reach === 0 ? t("reachNone") : t("reach", { count: reach })}
        </p>
      </div>
    </form>
  );
}
