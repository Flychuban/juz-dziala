"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { StarIcon } from "lucide-react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { useAutosavedState, useErrorText } from "~/components/ideas/client-utils";
import { TextAreaField } from "~/components/ideas/form";
import {
  ContactFieldset,
  GminaPicker,
  gminaOrUndefined,
  useContactError,
  WhoFieldset,
  type GminaOption,
  type PowiatOption,
} from "~/components/ideas/people-fields";
import { Stepper, type StepperStep } from "~/components/kit";
import type { AuthorRole, ContactPref } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type Created = { code: string; accessToken: string };

function SubmitError({ message }: { message: string }) {
  const t = useTranslations("tester.forms");
  return message ? (
    <p role="alert" className="border-destructive mt-6 border-l-4 pl-3 font-semibold">
      <span className="text-destructive">{t("notSent")} </span>
      {message}
    </p>
  ) : null;
}

/** A restored-draft line, shown once above the form. */
function Restored({ show }: { show: boolean }) {
  const t = useTranslations("tester.forms");
  return show ? (
    <p role="status" className="border-hairline mb-6 border-b pb-4">
      {t("restored")}
    </p>
  ) : null;
}

type SignUpDraft = {
  step: number;
  authorRole: AuthorRole;
  onBehalf: boolean;
  note: string;
  gmina: string | undefined;
  contactPref: ContactPref;
  /** Kept in memory only — never written to this device's storage. */
  contact: string;
};

/** „Chcę testować" — who you are, gmina, contact → Sprawa kind "test". Answers are autosaved (without the contact). */
export function TestSignUpWizard({
  innovation,
  gminas,
  powiaty,
  backHref,
}: {
  innovation: { id: string; title: string; lang?: "pl" | "en" };
  gminas: GminaOption[];
  powiaty: PowiatOption[];
  backHref: string;
}) {
  const t = useTranslations("tester.signUp");
  const errorText = useErrorText();
  const contactError = useContactError();
  const draft = useAutosavedState<SignUpDraft>(
    `jd_test_signup_${innovation.id}`,
    { step: 0, authorRole: "resident", onBehalf: false, note: "", gmina: undefined, contactPref: "email", contact: "" },
    ["contact"],
  );
  const d = draft.value;
  const set = (patch: Partial<SignUpDraft>) => draft.set((v) => ({ ...v, ...patch }));
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState("");
  const signUp = api.tests.signUp.useMutation();

  if (created) return <CaseCreatedPanel code={created.code} token={created.accessToken} heading={t("created")} />;

  const steps: StepperStep[] = [
    {
      id: "who",
      title: t("who.title"),
      description: (
        <>
          {t("who.description")} <span lang={innovation.lang === "pl" ? "pl" : undefined}>„{innovation.title}”</span>.
        </>
      ),
      content: (
        <div className="flex flex-col gap-6">
          <WhoFieldset value={{ authorRole: d.authorRole, onBehalf: d.onBehalf }} onChange={(v) => set(v)} legend={t("who.legend")} />
          <TextAreaField
            label={t("who.note")}
            hint={t("who.noteHint")}
            value={d.note}
            onChange={(note) => set({ note })}
            maxLength={2000}
            rows={3}
            required={false}
          />
        </div>
      ),
    },
    {
      id: "where",
      title: t("where.title"),
      content: <GminaPicker gminas={gminas} powiaty={powiaty} value={d.gmina} onChange={(gmina) => set({ gmina })} />,
      validate: () => (d.gmina && !gminaOrUndefined(d.gmina) ? t("errors.gmina") : null),
    },
    {
      id: "contact",
      title: t("contact.title"),
      description: t("contact.description"),
      content: (
        <>
          <ContactFieldset
            value={{ contactPref: d.contactPref, contact: d.contact }}
            onChange={(v) => set(v)}
            legend={t("contact.legend")}
          />
          <SubmitError message={error} />
        </>
      ),
      validate: () => contactError({ contactPref: d.contactPref, contact: d.contact }),
    },
  ];

  return (
    <>
      <Restored show={draft.restored} />
      <Stepper
        steps={steps}
        step={d.step}
        onStepChange={(step) => set({ step })}
        backHref={backHref}
        finishLabel={t("finish")}
        busy={signUp.isPending}
        onFinish={async () => {
          setError("");
          try {
            const res = await signUp.mutateAsync({
              innovationId: innovation.id,
              authorRole: d.authorRole,
              onBehalf: d.onBehalf,
              note: d.note.trim() || undefined,
              gminaTeryt: gminaOrUndefined(d.gmina),
              contactPref: d.contactPref,
              contact: d.contactPref === "none" ? undefined : d.contact.trim(),
            });
            draft.clear();
            setCreated(res);
          } catch (e) {
            setError(errorText(e));
          }
        }}
      />
    </>
  );
}

/** 1–5 as five large radio buttons, each with its word — never stars alone. */
export function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const t = useTranslations("tester");
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-lg font-semibold">{t("rate.legend")}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {(["1", "2", "3", "4", "5"] as const).map((k) => {
          const n = Number(k);
          return (
            <label
              key={k}
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
                <span className="block text-[0.9375rem] font-semibold">{t(`rating.${k}`)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

type RateDraft = {
  step: number;
  rating: number | null;
  works: string;
  improve: string;
  suggestion: string;
  contactPref: ContactPref;
  /** Kept in memory only — never written to this device's storage. */
  contact: string;
};

/** Rating 1–5 + „Co działa? / Co poprawić? / Twój pomysł" → Sprawa kind "feedback". Answers are autosaved (without the contact). */
export function RateWizard({
  innovation,
  backHref,
}: {
  innovation: { id: string; title: string; lang?: "pl" | "en" };
  backHref: string;
}) {
  const t = useTranslations("tester.rate");
  const errorText = useErrorText();
  const contactError = useContactError();
  const draft = useAutosavedState<RateDraft>(
    `jd_test_rate_${innovation.id}`,
    { step: 0, rating: null, works: "", improve: "", suggestion: "", contactPref: "none", contact: "" },
    ["contact"],
  );
  const d = draft.value;
  const set = (patch: Partial<RateDraft>) => draft.set((v) => ({ ...v, ...patch }));
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState("");
  const rate = api.tests.rate.useMutation();

  if (created) return <CaseCreatedPanel code={created.code} token={created.accessToken} heading={t("created")} />;

  const steps: StepperStep[] = [
    {
      id: "rating",
      title: t("title", { title: innovation.title }),
      content: <StarRating value={d.rating} onChange={(rating) => set({ rating })} />,
      validate: () => (d.rating ? null : t("errors.rating")),
    },
    {
      id: "works",
      title: t("works.title"),
      content: (
        <TextAreaField
          label={t("works.label")}
          hint={t("works.hint")}
          value={d.works}
          onChange={(works) => set({ works })}
          maxLength={2000}
          required={false}
        />
      ),
    },
    {
      id: "improve",
      title: t("improve.title"),
      content: (
        <TextAreaField
          label={t("improve.label")}
          hint={t("improve.hint")}
          value={d.improve}
          onChange={(improve) => set({ improve })}
          maxLength={2000}
          required={false}
        />
      ),
    },
    {
      id: "idea",
      title: t("idea.title"),
      content: (
        <div className="flex flex-col gap-8">
          <TextAreaField
            label={t("idea.label")}
            hint={t("idea.hint")}
            value={d.suggestion}
            onChange={(suggestion) => set({ suggestion })}
            maxLength={2000}
            required={false}
          />
          <ContactFieldset value={{ contactPref: d.contactPref, contact: d.contact }} onChange={(v) => set(v)} legend={t("idea.contact")} />
          <SubmitError message={error} />
        </div>
      ),
      validate: () => contactError({ contactPref: d.contactPref, contact: d.contact }),
    },
  ];

  return (
    <>
      <Restored show={draft.restored} />
      <Stepper
        steps={steps}
        step={d.step}
        onStepChange={(step) => set({ step })}
        backHref={backHref}
        finishLabel={t("finish")}
        busy={rate.isPending}
        onFinish={async () => {
          setError("");
          try {
            const res = await rate.mutateAsync({
              innovationId: innovation.id,
              rating: d.rating ?? 0,
              works: d.works.trim(),
              improve: d.improve.trim(),
              suggestion: d.suggestion.trim(),
              contactPref: d.contactPref,
              contact: d.contactPref === "none" ? undefined : d.contact.trim(),
            });
            draft.clear();
            setCreated(res);
          } catch (e) {
            setError(errorText(e));
          }
        }}
      />
    </>
  );
}
