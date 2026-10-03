"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useId, useRef, useState, useEffect } from "react";

import { CONTACT_PREF_LABEL, CONTACT_PREFS, type ContactPref, type MapaArea } from "~/lib/domain";
import { api } from "~/trpc/react";
import { btnPrimary, btnSecondary } from "./styles";

/**
 * „Poproś ROPS o pomoc": a two-screen form that opens a „need" case for this
 * match run. The cases router belongs to module V (Agent B); until it is
 * merged, `cases.create` does not exist and the form says so plainly.
 * Swap LocalCaseCreatedPanel for `CaseCreatedPanel` from src/components/cases/ when available.
 */
type CreateNeedInput = {
  kind: "need";
  matchRunId: string;
  title: string;
  body: string;
  areas: MapaArea[];
  contactPref: ContactPref;
  contact?: string;
  onBehalf: boolean;
};
type CreatedCase = { code: string; token?: string };

function useCreateNeedCase() {
  const utils = api.useUtils();
  return (input: CreateNeedInput): Promise<CreatedCase> => {
    // Typed loosely on purpose: the procedure is added by another module.
    const client = utils.client as unknown as {
      cases: { create: { mutate: (i: CreateNeedInput) => Promise<CreatedCase> } };
    };
    return client.cases.create.mutate(input);
  };
}

function errorText(e: unknown): string {
  if (e instanceof TRPCClientError) {
    const code = (e.data as { code?: string } | undefined)?.code;
    if (code === "NOT_FOUND") {
      return "Wysyłanie próśb do ROPS uruchamiamy w tej chwili. Spróbuj ponownie za kilka minut.";
    }
    if (code === "TOO_MANY_REQUESTS") return "Za dużo zgłoszeń w krótkim czasie. Spróbuj za kilka minut.";
    if (code === "BAD_REQUEST") return "Sprawdź wpisane dane kontaktowe i spróbuj ponownie.";
  }
  return "Nie udało się wysłać prośby. Sprawdź połączenie i spróbuj ponownie.";
}

const needsContact = (p: ContactPref) => p !== "none";

function validContact(pref: ContactPref, value: string): boolean {
  if (pref === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value.trim());
  if (pref === "sms" || pref === "phone") return value.replace(/[^0-9]/g, "").length >= 9;
  return true;
}

export function LocalCaseCreatedPanel({ code }: { code: string; token?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg">Twój kod sprawy:</p>
      <p className="font-mono text-4xl font-bold tracking-widest" aria-label={`Kod sprawy: ${code.split("").join(" ")}`}>
        {code}
      </p>
      <p className="max-w-prose">
        Zapisz go albo wydrukuj. Odpowiedź ROPS sprawdzisz na stronie{" "}
        <Link href="/case" className="underline">
          Moja sprawa
        </Link>
        , wpisując ten kod.
      </p>
      <div className="flex flex-wrap gap-2" data-no-print>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true));
          }}
        >
          {copied ? "Skopiowano" : "Kopiuj kod"}
        </button>
        <button type="button" className={btnSecondary} onClick={() => window.print()}>
          Drukuj
        </button>
      </div>
    </div>
  );
}

export function RequestHelp({
  runId,
  query,
  areas,
  abstained,
}: {
  runId: string;
  query: string;
  areas: MapaArea[];
  abstained: boolean;
}) {
  const create = useCreateNeedCase();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [pref, setPref] = useState<ContactPref>("none");
  const [contact, setContact] = useState("");
  const [onBehalf, setOnBehalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCase | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ids = { legend: useId(), contact: useId(), contactHint: useId(), behalf: useId(), err: useId() };

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsContact(pref) && !validContact(pref, contact)) {
      setError(pref === "email" ? "Wpisz poprawny adres e-mail." : "Wpisz numer telefonu (9 cyfr).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await create({
        kind: "need",
        matchRunId: runId,
        title: query.length > 80 ? `${query.slice(0, 79)}…` : query,
        body: query,
        areas,
        contactPref: pref,
        ...(needsContact(pref) ? { contact: contact.trim() } : {}),
        onBehalf,
      });
      setCreated(res);
      setStep(2);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 0) {
    return (
      <section aria-labelledby="help-heading" className="border-hairline bg-surface rounded-lg border p-5">
        <h2 id="help-heading" className="text-2xl font-bold">
          {abstained ? "Przekażemy to ekspertowi ROPS" : "Potrzebujesz pomocy człowieka?"}
        </h2>
        <p className="mt-2 max-w-prose">
          Pracownik ROPS przeczyta Twój opis (bez danych osobowych) i odpowie. Nie musisz zakładać konta — dostaniesz
          kod sprawy.
        </p>
        <button type="button" className={`${btnPrimary} mt-4`} onClick={() => setStep(1)} data-no-print>
          Poproś ROPS o pomoc
        </button>
      </section>
    );
  }

  if (step === 2 && created) {
    return (
      <section aria-labelledby="help-done" className="border-success rounded-lg border-2 p-5">
        <h2 id="help-done" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
          Prośba wysłana
        </h2>
        <div className="mt-3">
          <LocalCaseCreatedPanel code={created.code} token={created.token} />
        </div>
      </section>
    );
  }

  const contactLabel = pref === "email" ? "Twój adres e-mail" : "Twój numer telefonu";
  return (
    <section aria-labelledby="help-step" className="border-hairline rounded-lg border p-5" data-no-print>
      <p className="text-muted-foreground text-sm">Krok 1 z 2</p>
      <h2 id="help-step" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
        Jak mamy się z Tobą skontaktować?
      </h2>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend id={ids.legend} className="sr-only">
            Sposób kontaktu
          </legend>
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
                  setError(null);
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
            <p id={ids.contactHint} className="text-muted-foreground text-sm">
              Zaszyfrujemy go. Zobaczy go tylko pracownik ROPS, który odpowie na Twoją sprawę.
            </p>
            <input
              id={ids.contact}
              type={pref === "email" ? "email" : "tel"}
              autoComplete={pref === "email" ? "email" : "tel"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              aria-describedby={error ? `${ids.contactHint} ${ids.err}` : ids.contactHint}
              aria-invalid={error ? true : undefined}
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
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? "Wysyłamy…" : "Wyślij prośbę"}
          </button>
        </div>
      </form>
    </section>
  );
}
