"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { useLabels } from "~/i18n/use-labels";
import { type ContactPref, type MapaArea } from "~/lib/domain";
import { api } from "~/trpc/react";
import { caseBody, caseTitle, type CaseWords } from "./format";
import { btnPrimary, btnSecondary } from "./styles";

/** Phone first: the people who most need a call are the least likely to type an e-mail. */
export const CONTACT_ORDER: readonly ContactPref[] = ["phone", "sms", "email", "none"];

const needsContact = (p: ContactPref) => p !== "none";

/**
 * „Poproś ROPS o pomoc": two screens — how to reach you, then the case code.
 * Opens a „need" case linked to this match run (cases.create, module V).
 * Controlled by the results page so the same form opens from each card and
 * from the sticky bar on phones.
 *
 * After an abstention the page promises a hand-over „jednym kliknięciem", so
 * this section then offers exactly that: one button that sends the case with
 * „Sprawdzę sam(a) kodem sprawy" and shows the code. Choosing a phone or
 * e-mail stays one click away.
 */
export function RequestHelp({
  runId,
  query,
  areas,
  gminaTeryt,
  powiatTeryt,
  resultTitles,
  abstained,
  open,
  onOpenChange,
  innovation,
  onCreated,
}: {
  runId: string;
  query: string;
  areas: MapaArea[];
  gminaTeryt: string | null;
  powiatTeryt: string | null;
  resultTitles: string[];
  abstained: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The card the resident asked about, when the form was opened from one. */
  innovation: { id: string; title: string } | null;
  onCreated: () => void;
}) {
  const t = useTranslations("match.help");
  const tc = useTranslations("match.caseText");
  const labels = useLabels();
  const [pref, setPref] = useState<ContactPref | null>(null);
  const [contact, setContact] = useState("");
  const [onBehalf, setOnBehalf] = useState(false);
  const [missingPref, setMissingPref] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ids = { contact: useId(), contactHint: useId(), behalf: useId(), err: useId(), prefErr: useId(), quickErr: useId() };
  const create = api.cases.create.useMutation({ onSuccess: onCreated });

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open, innovation?.id]);

  const words: CaseWords = {
    query: (q) => tc("query", { query: q }),
    askedAbout: (title) => tc("askedAbout", { title }),
    abstained: tc("abstained"),
    shown: (titles) => tc("shown", { titles }),
    quote: (title) => tc("quoted", { title }),
  };

  const fieldErrors = create.error?.data?.zodError?.fieldErrors as Record<string, string[] | undefined> | undefined;
  const error = create.error
    ? (fieldErrors?.contact?.[0] ?? (create.error.data?.code === "TOO_MANY_REQUESTS" ? t("errors.rate") : t("errors.failed")))
    : null;

  const send = (contactPref: ContactPref) =>
    create.mutate({
      kind: "need",
      matchRunId: runId,
      title: caseTitle(query, tc("title")),
      body: caseBody(query, resultTitles, abstained, innovation?.title ?? null, words),
      areas,
      ...(innovation ? { innovationId: innovation.id } : {}),
      ...(gminaTeryt ? { gminaTeryt } : {}),
      ...(powiatTeryt ? { powiatTeryt } : {}),
      contactPref,
      ...(needsContact(contactPref) ? { contact: contact.trim() } : {}),
      onBehalf,
    });

  if (create.data) {
    return <CaseCreatedPanel code={create.data.code} token={create.data.accessToken} heading={t("created")} />;
  }

  if (!open) {
    return (
      <section id="help" aria-labelledby="help-heading" className="border-hairline bg-surface rounded-lg border p-5 sm:p-7">
        <h2 id="help-heading" className="text-2xl font-bold">
          {abstained ? t("abstainHeading") : t("heading")}
        </h2>
        <p className="mt-2 max-w-prose text-lg">{abstained ? t("abstainBody") : t("body")}</p>
        {abstained ? (
          <div className="mt-4 flex flex-wrap gap-3" data-no-print>
            <button
              type="button"
              className={btnPrimary}
              disabled={create.isPending}
              aria-describedby={error ? ids.quickErr : undefined}
              onClick={() => send("none")}
            >
              {create.isPending ? t("quickSending") : t("quickSend")}
            </button>
            <button type="button" className={btnSecondary} onClick={() => onOpenChange(true)}>
              {t("chooseContact")}
            </button>
          </div>
        ) : (
          <button type="button" className={`${btnPrimary} mt-4`} onClick={() => onOpenChange(true)} data-no-print>
            {t("open")}
          </button>
        )}
        {error && (
          <p id={ids.quickErr} role="alert" className="text-destructive mt-3 font-semibold">
            {error}
          </p>
        )}
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pref) {
      setMissingPref(true);
      document.getElementById(`${ids.prefErr}-first`)?.focus();
      return;
    }
    send(pref);
  };

  const contactLabel = pref === "email" ? t("emailLabel") : t("phoneLabel");
  return (
    <section id="help" aria-labelledby="help-step" className="border-hairline rounded-lg border p-5 sm:p-7" data-no-print>
      <p className="text-muted-foreground">{t("step")}</p>
      <h2 id="help-step" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
        {t("stepHeading")}
      </h2>
      {innovation && <p className="mt-1 text-lg">{t("about", { title: innovation.title })}</p>}
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2" aria-describedby={missingPref ? ids.prefErr : undefined}>
          <legend className="sr-only">{t("contactLegend")}</legend>
          {CONTACT_ORDER.map((p, i) => (
            <label
              key={p}
              className="border-input has-[:checked]:border-primary has-[:checked]:bg-accent flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2"
            >
              <input
                type="radio"
                name="contactPref"
                value={p}
                id={i === 0 ? `${ids.prefErr}-first` : undefined}
                checked={pref === p}
                onChange={() => {
                  setPref(p);
                  setMissingPref(false);
                  create.reset();
                }}
                className="size-5"
              />
              <span className="text-lg">{labels.contactPref[p]}</span>
            </label>
          ))}
          {missingPref && (
            <p id={ids.prefErr} role="alert" className="text-destructive font-semibold">
              {t("missingPref")}
            </p>
          )}
        </fieldset>

        {pref && needsContact(pref) && (
          <div className="flex max-w-md flex-col gap-2">
            <label htmlFor={ids.contact} className="font-semibold">
              {contactLabel}
            </label>
            <p id={ids.contactHint} className="text-muted-foreground">
              {t("contactHint")}
            </p>
            <input
              id={ids.contact}
              type={pref === "email" ? "email" : "tel"}
              autoComplete={pref === "email" ? "email" : "tel"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              aria-describedby={error ? `${ids.contactHint} ${ids.err}` : ids.contactHint}
              aria-invalid={fieldErrors?.contact ? true : undefined}
              className="border-input bg-background min-h-12 rounded-lg border-2 px-3 text-lg"
            />
          </div>
        )}

        <label htmlFor={ids.behalf} className="flex min-h-12 items-center gap-3">
          <input
            id={ids.behalf}
            type="checkbox"
            checked={onBehalf}
            onChange={(e) => setOnBehalf(e.target.checked)}
            className="size-5"
          />
          <span className="text-lg">{t("onBehalf")}</span>
        </label>

        {error && (
          <p id={ids.err} role="alert" className="text-destructive font-semibold">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={btnSecondary} onClick={() => onOpenChange(false)}>
            {t("back")}
          </button>
          <button type="submit" className={btnPrimary} disabled={create.isPending}>
            {create.isPending ? t("sending") : t("submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
