"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileCheckIcon } from "lucide-react";

import { ExternalLink } from "~/components/kit/external-link";
import { Stepper, type StepperStep } from "~/components/kit/stepper";
import {
  GminaCombobox,
  type GminaChoice,
} from "~/components/municipality/gmina-combobox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import {
  BUDGET_RANGES,
  INSTITUTIONS,
  MAX_NEEDS_CHARS,
  optionLabels,
  STAFF_RANGES,
  TIMEFRAMES,
  type BudgetRange,
  type Institution,
  type PlanInputs,
  type StaffRange,
  type Timeframe,
} from "~/server/adapt/options";
import type { AdaptInnovationOption } from "~/server/api/routers/adapt";
import { InnovationPicker } from "./innovation-picker";
import { PlanView } from "./plan-view";

type Answers = {
  innovationId: string | null;
  institution: Institution | null;
  gminaTeryt: string | null;
  staff: StaffRange | null;
  budget: BudgetRange | null;
  timeframe: Timeframe | null;
  groupSize: string;
  needs: string;
};

const DRAFT_KEY = "jd_adapt_draft";

function readDraft(): { answers: Answers; step: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as { answers: Answers; step: number }) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: { answers: Answers; step: number }) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage blocked — the form still works */
  }
}

/** Radio cards: a fieldset with a visible legend and native radios. */
function Choices<T extends string>(props: {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (v: T) => void;
  hints?: Partial<Record<T, string>>;
  columns?: 1 | 2;
  legendClassName?: string;
}) {
  const { legend, name, options, labels, value, onChange, hints } = props;
  return (
    <fieldset>
      <legend className={cn("text-base font-semibold", props.legendClassName)}>
        {legend}
      </legend>
      <div
        className={cn(
          "mt-2 grid grid-cols-1 gap-3",
          props.columns === 2 && "sm:grid-cols-2",
        )}
      >
        {options.map((o) => (
          <label
            key={o}
            className="border-input hover:bg-surface has-[:checked]:border-primary has-[:checked]:bg-accent flex min-h-12 cursor-pointer items-start gap-3 rounded-md border-2 px-4 py-3"
          >
            <input
              type="radio"
              name={name}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
              className="accent-primary mt-1 size-5 shrink-0"
            />
            <span>
              <span className="block font-semibold">{labels[o]}</span>
              {hints?.[o] ? (
                <span className="text-foreground/85 block text-[0.9375rem] leading-snug">
                  {hints[o]}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * /adapt — the Middleman: four questions, then the streamed Ramowy Plan
 * Wdrożenia. Answers are kept in this tab (sessionStorage) so „Wstecz",
 * a reload or „Zmień odpowiedzi" never lose them.
 */
export function AdaptWizard({
  innovations,
  gminas,
  initialInnovationId,
  initialGminaTeryt,
}: {
  innovations: AdaptInnovationOption[];
  gminas: GminaChoice[];
  initialInnovationId: string | null;
  initialGminaTeryt: string | null;
}) {
  const id = useId();
  const t = useTranslations("adapt.wizard");
  const tv = useTranslations("adapt.validation");
  const tb = useTranslations("adapt");
  const o = optionLabels(useLocale());
  const [answers, setAnswers] = useState<Answers>({
    innovationId: initialInnovationId,
    institution: null,
    gminaTeryt: initialGminaTeryt,
    staff: null,
    budget: null,
    timeframe: null,
    groupSize: "",
    needs: "",
  });
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<PlanInputs | null>(null);
  const restored = useRef(false);

  // Restore the draft once; a link with ?innovation / ?gmina wins over it.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const d = readDraft();
    if (!d) return;
    setAnswers({
      ...d.answers,
      groupSize: d.answers.groupSize ?? "",
      needs: d.answers.needs ?? "",
      innovationId: initialInnovationId ?? d.answers.innovationId,
      gminaTeryt: initialGminaTeryt ?? d.answers.gminaTeryt,
    });
    if (!initialInnovationId && !initialGminaTeryt) {
      setStep(Math.min(Math.max(d.step, 0), 3));
    }
  }, [initialInnovationId, initialGminaTeryt]);

  useEffect(() => {
    if (restored.current) writeDraft({ answers, step });
  }, [answers, step]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) =>
    setAnswers((a) => ({ ...a, [k]: v }));

  const innovation = useMemo(
    () => innovations.find((i) => i.id === answers.innovationId) ?? null,
    [innovations, answers.innovationId],
  );
  const gmina = gminas.find((g) => g.teryt === answers.gminaTeryt) ?? null;

  const groupSizeError = (() => {
    const v = answers.groupSize.trim().replace(/\s/g, "");
    if (!v) return null;
    if (!/^\d+$/.test(v)) return tv("groupSizeDigits");
    const n = Number(v);
    if (n < 1) return tv("groupSizeMin");
    if (n > 1_000_000) return tv("groupSizeMax");
    return null;
  })();

  const steps: StepperStep[] = [
    {
      id: "innovation",
      title: t("innovation.title"),
      description: t("innovation.description"),
      content: (
        <div>
          {innovation?.ramowyPlan ? (
            <p className="border-brand-accent mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 py-1 pl-4">
              <FileCheckIcon aria-hidden="true" className="text-brand-accent size-5" />
              <span className="font-semibold">{tb("ramowyBadge")}.</span>
              {innovation.ramowyPlan.sourceUrl ? (
                <ExternalLink
                  href={innovation.ramowyPlan.sourceUrl}
                  className="inline-flex min-h-11 items-center"
                >
                  {t("innovation.callLink")}
                </ExternalLink>
              ) : null}
            </p>
          ) : null}
          <InnovationPicker
            options={innovations}
            value={answers.innovationId}
            onChange={(v) => set("innovationId", v)}
          />
        </div>
      ),
      validate: () => (innovation ? null : tv("innovation")),
    },
    {
      id: "institution",
      title: t("institution.title"),
      description: t("institution.description"),
      content: (
        <Choices
          legend={t("institution.legend")}
          legendClassName="sr-only"
          name={`${id}-institution`}
          options={INSTITUTIONS}
          labels={o.institution}
          hints={o.institutionHint}
          value={answers.institution}
          onChange={(v) => set("institution", v)}
          columns={2}
        />
      ),
      validate: () => (answers.institution ? null : tv("institution")),
    },
    {
      id: "gmina",
      title: t("gmina.title"),
      description: t("gmina.description"),
      content: (
        <GminaCombobox
          options={gminas}
          value={answers.gminaTeryt}
          onChange={(teryt) => set("gminaTeryt", teryt)}
          label={t("gmina.label")}
          description={t("gmina.hint")}
        />
      ),
      validate: () => (gmina ? null : tv("gminaPick")),
    },
    {
      id: "resources",
      title: t("resources.title"),
      description: t("resources.description"),
      content: (
        <div className="space-y-8">
          <Choices
            legend={t("resources.staff")}
            name={`${id}-staff`}
            options={STAFF_RANGES}
            labels={o.staff}
            value={answers.staff}
            onChange={(v) => set("staff", v)}
            columns={2}
          />
          <Choices
            legend={t("resources.budget")}
            name={`${id}-budget`}
            options={BUDGET_RANGES}
            labels={o.budget}
            value={answers.budget}
            onChange={(v) => set("budget", v)}
            columns={2}
          />
          <Choices
            legend={t("resources.timeframe")}
            name={`${id}-timeframe`}
            options={TIMEFRAMES}
            labels={o.timeframe}
            value={answers.timeframe}
            onChange={(v) => set("timeframe", v)}
          />
          <div>
            <label htmlFor={`${id}-size`} className="block font-semibold">
              {t("resources.groupSize")}
            </label>
            <p id={`${id}-size-h`} className="text-muted-foreground text-[0.9375rem]">
              {t("resources.groupSizeHint")}
            </p>
            <Input
              id={`${id}-size`}
              inputMode="numeric"
              autoComplete="off"
              className="mt-2 max-w-48"
              value={answers.groupSize}
              aria-describedby={`${id}-size-h`}
              aria-invalid={groupSizeError ? true : undefined}
              onChange={(e) => set("groupSize", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${id}-needs`} className="block font-semibold">
              {t("resources.needs")}
            </label>
            <p id={`${id}-needs-h`} className="text-muted-foreground text-[0.9375rem]">
              {t("resources.needsHint")}
            </p>
            <Textarea
              id={`${id}-needs`}
              className="mt-2"
              maxLength={MAX_NEEDS_CHARS}
              value={answers.needs}
              aria-describedby={`${id}-needs-h ${id}-needs-c`}
              onChange={(e) => set("needs", e.target.value)}
            />
            <p id={`${id}-needs-c`} className="text-muted-foreground mt-1 text-sm tabular">
              {t("resources.needsCount", {
                count: answers.needs.length,
                max: MAX_NEEDS_CHARS,
              })}
            </p>
          </div>
        </div>
      ),
      validate: () => {
        if (!answers.staff) return tv("staff");
        if (!answers.budget) return tv("budget");
        if (!answers.timeframe) return tv("timeframe");
        return groupSizeError;
      },
    },
  ];

  if (plan && innovation && gmina) {
    return (
      <PlanView
        inputs={plan}
        innovation={innovation}
        gminaName={gmina.label}
        onEdit={() => {
          setPlan(null);
          setStep(3);
        }}
      />
    );
  }

  return (
    <Stepper
      steps={steps}
      step={step}
      onStepChange={setStep}
      finishLabel={t("finish")}
      backHref="/library"
      onFinish={() => {
        if (
          !innovation ||
          !gmina ||
          !answers.institution ||
          !answers.staff ||
          !answers.budget ||
          !answers.timeframe
        )
          return;
        const size = answers.groupSize.trim().replace(/\s/g, "");
        setPlan({
          innovationId: innovation.id,
          institution: answers.institution,
          gminaTeryt: gmina.teryt,
          staff: answers.staff,
          budget: answers.budget,
          timeframe: answers.timeframe,
          groupSize: size ? Number(size) : null,
          needs: answers.needs.trim() || null,
        });
      }}
    />
  );
}
