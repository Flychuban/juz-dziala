"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { CONTACT_PREF_LABEL, CONTACT_PREFS, type ContactPref, type MapaArea } from "~/lib/domain";
import { api } from "~/trpc/react";
import { caseBody, caseTitle } from "./format";
import { btnPrimary, btnSecondary } from "./styles";

const needsContact = (p: ContactPref) => p !== "none";

/**
 * „Poproś ROPS o pomoc": two screens — how to reach you, then the case code.
 * Opens a „need" case linked to this match run (cases.create, module V).
 */
export function RequestHelp({
  runId,
  query,
  areas,
  gminaTeryt,
  powiatTeryt,
  resultTitles,
  abstained,
}: {
  runId: string;
  query: string;
  areas: MapaArea[];
  gminaTeryt: string | null;
  powiatTeryt: string | null;
  resultTitles: string[];
  abstained: boolean;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [pref, setPref] = useState<ContactPref>("none");
  const [contact, setContact] = useState("");
  const [onBehalf, setOnBehalf] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ids = { contact: useId(), contactHint: useId(), behalf: useId(), err: useId() };
  const create = api.cases.create.useMutation();

  useEffect(() => {
    if (step === 1) headingRef.current?.focus();
  }, [step]);

  const fieldErrors = create.error?.data?.zodError?.fieldErrors as Record<string, string[] | undefined> | undefined;
  const error = create.error
    ? (fieldErrors?.contact?.[0] ??
      (create.error.data?.code === "TOO_MANY_REQUESTS"
        ? "Za dużo zgłoszeń w krótkim czasie. Spróbuj za kilka minut."
        : "Nie udało się wysłać prośby. Sprawdź połączenie i spróbuj ponownie."))
    : null;

  if (create.data) {
    return <CaseCreatedPanel code={create.data.code} token={create.data.accessToken} heading="Prośba wysłana do ROPS" />;
  }

  if (step === 0) {
    return (
      <section aria-labelledby="help-heading" className="border-hairline bg-surface rounded-lg border p-5 sm:p-7">
        <h2 id="help-heading" className="text-2xl font-bold">
          {abstained ? "Przekażemy to ekspertowi ROPS" : "Potrzebujesz pomocy człowieka?"}
        </h2>
        <p className="mt-2 max-w-prose text-lg">
          Pracownik ROPS przeczyta Twój opis (bez danych osobowych) i odpowie. Nie musisz zakładać konta — dostaniesz
          kod sprawy.
        </p>
        <button type="button" className={`${btnPrimary} mt-4`} onClick={() => setStep(1)} data-no-print>
          Poproś ROPS o pomoc
        </button>
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      kind: "need",
      matchRunId: runId,
      title: caseTitle(query),
      body: caseBody(query, resultTitles, abstained),
      areas,
      ...(gminaTeryt ? { gminaTeryt } : {}),
      ...(powiatTeryt ? { powiatTeryt } : {}),
      contactPref: pref,
      ...(needsContact(pref) ? { contact: contact.trim() } : {}),
      onBehalf,
    });
  };

  const contactLabel = pref === "email" ? "Twój adres e-mail" : "Twój numer telefonu";
  return (
    <section aria-labelledby="help-step" className="border-hairline rounded-lg border p-5 sm:p-7" data-no-print>
      <p className="text-muted-foreground">Krok 1 z 2</p>
      <h2 id="help-step" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
        Jak mamy się z Tobą skontaktować?
      </h2>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Sposób kontaktu</legend>
          {CONTACT_PREFS.map((p) => (
            <label
              key={p}
              className="border-input has-[:checked]:border-primary has-[:checked]:bg-accent flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2"
            >
              <input
                type="radio"
                name="contactPref"
                value={p}
                checked={pref === p}
                onChange={() => {
                  setPref(p);
                  create.reset();
                }}
                className="size-5"
              />
              <span className="text-lg">{CONTACT_PREF_LABEL[p]}</span>
            </label>
          ))}
        </fieldset>

        {needsContact(pref) && (
          <div className="flex max-w-md flex-col gap-2">
            <label htmlFor={ids.contact} className="font-semibold">
              {contactLabel}
            </label>
            <p id={ids.contactHint} className="text-muted-foreground">
              Zaszyfrujemy go. Zobaczy go tylko pracownik ROPS, który odpowie na Twoją sprawę.
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
          <span className="text-lg">Zgłaszam w imieniu innej osoby</span>
        </label>

        {error && (
          <p id={ids.err} role="alert" className="text-destructive font-semibold">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={btnSecondary} onClick={() => setStep(0)}>
            Wstecz
          </button>
          <button type="submit" className={btnPrimary} disabled={create.isPending}>
            {create.isPending ? "Wysyłamy…" : "Wyślij prośbę"}
          </button>
        </div>
      </form>
    </section>
  );
}
