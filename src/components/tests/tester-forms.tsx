"use client";

import { useState } from "react";
import { StarIcon } from "lucide-react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { errorText } from "~/components/ideas/client-utils";
import { TextAreaField } from "~/components/ideas/form";
import {
  ContactFieldset,
  contactError,
  GminaPicker,
  gminaOrUndefined,
  WhoFieldset,
  type ContactValue,
  type GminaOption,
  type PowiatOption,
  type WhoFields,
} from "~/components/ideas/people-fields";
import { Stepper, type StepperStep } from "~/components/kit";
import { cn } from "~/lib/utils";
import { RATING_LABEL } from "~/server/ideas/schema";
import { api } from "~/trpc/react";

type Created = { code: string; accessToken: string };

function SubmitError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="border-destructive mt-6 border-l-4 pl-3 font-semibold">
      <span className="text-destructive">Nie wysłano: </span>
      {message}
    </p>
  ) : null;
}

/** „Chcę testować" — who you are, gmina, contact → Sprawa kind "test". */
export function TestSignUpWizard({
  innovation,
  gminas,
  powiaty,
  backHref,
}: {
  innovation: { id: string; title: string };
  gminas: GminaOption[];
  powiaty: PowiatOption[];
  backHref: string;
}) {
  const [who, setWho] = useState<WhoFields>({ authorRole: "resident", onBehalf: false });
  const [note, setNote] = useState("");
  const [gmina, setGmina] = useState<string | undefined>();
  const [contact, setContact] = useState<ContactValue>({ contactPref: "email", contact: "" });
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState("");
  const signUp = api.tests.signUp.useMutation();

  if (created) return <CaseCreatedPanel code={created.code} token={created.accessToken} heading="Zgłoszenie do testów przyjęte" />;

  const steps: StepperStep[] = [
    {
      id: "who",
      title: "Kim jesteś?",
      description: `Zgłaszasz chęć testowania: „${innovation.title}”.`,
      content: (
        <div className="flex flex-col gap-6">
          <WhoFieldset value={who} onChange={setWho} legend="Zgłaszam się jako" />
          <TextAreaField
            label="Dlaczego chcesz testować?"
            hint="Np. „Opiekuję się mamą z demencją, chętnie sprawdzę to w domu”."
            value={note}
            onChange={setNote}
            maxLength={2000}
            rows={3}
            required={false}
          />
        </div>
      ),
    },
    {
      id: "where",
      title: "Gdzie mieszkasz lub działasz?",
      content: <GminaPicker gminas={gminas} powiaty={powiaty} value={gmina} onChange={setGmina} />,
      validate: () => (gmina && !gminaOrUndefined(gmina) ? "Wybierz gminę w wybranym powiecie albo „— nie wybieram —”." : null),
    },
    {
      id: "contact",
      title: "Jak mamy się z Tobą skontaktować?",
      description: "Zespół ROPS odezwie się, gdy testy ruszą.",
      content: (
        <>
          <ContactFieldset value={contact} onChange={setContact} legend="Sposób kontaktu" />
          <SubmitError message={error} />
        </>
      ),
      validate: () => contactError(contact),
    },
  ];

  return (
    <Stepper
      steps={steps}
      backHref={backHref}
      finishLabel="Zgłaszam się do testów"
      busy={signUp.isPending}
      onFinish={async () => {
        setError("");
        try {
          setCreated(
            await signUp.mutateAsync({
              innovationId: innovation.id,
              ...who,
              note: note.trim() || undefined,
              gminaTeryt: gminaOrUndefined(gmina),
              contactPref: contact.contactPref,
              contact: contact.contactPref === "none" ? undefined : contact.contact.trim(),
            }),
          );
        } catch (e) {
          setError(errorText(e));
        }
      }}
    />
  );
}

/** 1–5 as five large radio buttons, each with its word — never stars alone. */
export function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-lg font-semibold">Twoja ocena (od 1 do 5)</legend>
      <div className="grid gap-3 sm:grid-cols-5">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <label
            key={n}
            className={cn(
              "border-input bg-background hover:bg-surface has-[:checked]:border-primary has-[:checked]:bg-accent flex min-h-16 cursor-pointer items-center gap-3 rounded-md border-2 px-4 py-3 sm:flex-col sm:items-center sm:text-center",
            )}
          >
            <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} className="accent-primary size-6 shrink-0" />
            <span className="flex items-center gap-0.5" aria-hidden="true">
              {Array.from({ length: n }, (_, i) => (
                <StarIcon key={i} className="fill-foreground size-4" />
              ))}
            </span>
            <span>
              <span className="tabular block text-xl font-bold">{n}</span>
              <span className="block text-[0.9375rem] font-semibold">{RATING_LABEL[n]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Rating 1–5 + „Co działa? / Co poprawić? / Twój pomysł" → Sprawa kind "feedback". */
export function RateWizard({
  innovation,
  backHref,
}: {
  innovation: { id: string; title: string };
  backHref: string;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [works, setWorks] = useState("");
  const [improve, setImprove] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [contact, setContact] = useState<ContactValue>({ contactPref: "none", contact: "" });
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState("");
  const rate = api.tests.rate.useMutation();

  if (created) return <CaseCreatedPanel code={created.code} token={created.accessToken} heading="Dziękujemy za opinię" />;

  const steps: StepperStep[] = [
    {
      id: "rating",
      title: `Jak oceniasz „${innovation.title}”?`,
      content: <StarRating value={rating} onChange={setRating} />,
      validate: () => (rating ? null : "Wybierz ocenę od 1 do 5."),
    },
    {
      id: "works",
      title: "Co działa?",
      content: (
        <TextAreaField label="Co działa dobrze?" hint="Co było pomocne, łatwe, przydatne?" value={works} onChange={setWorks} maxLength={2000} required={false} />
      ),
    },
    {
      id: "improve",
      title: "Co poprawić?",
      content: (
        <TextAreaField label="Co trzeba poprawić?" hint="Co przeszkadzało, było trudne albo nie działało?" value={improve} onChange={setImprove} maxLength={2000} required={false} />
      ),
    },
    {
      id: "idea",
      title: "Twój pomysł na ulepszenie",
      content: (
        <div className="flex flex-col gap-8">
          <TextAreaField
            label="Co można zrobić lepiej?"
            hint="Każdy pomysł się liczy."
            value={suggestion}
            onChange={setSuggestion}
            maxLength={2000}
            required={false}
          />
          <ContactFieldset value={contact} onChange={setContact} legend="Czy mamy się z Tobą skontaktować?" />
          <SubmitError message={error} />
        </div>
      ),
      validate: () => contactError(contact),
    },
  ];

  return (
    <Stepper
      steps={steps}
      backHref={backHref}
      finishLabel="Wyślij opinię"
      busy={rate.isPending}
      onFinish={async () => {
        setError("");
        try {
          setCreated(
            await rate.mutateAsync({
              innovationId: innovation.id,
              rating: rating ?? 0,
              works: works.trim(),
              improve: improve.trim(),
              suggestion: suggestion.trim(),
              contactPref: contact.contactPref,
              contact: contact.contactPref === "none" ? undefined : contact.contact.trim(),
            }),
          );
        } catch (e) {
          setError(errorText(e));
        }
      }}
    />
  );
}
