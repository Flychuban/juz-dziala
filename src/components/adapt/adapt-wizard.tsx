"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  BUDGET_LABEL,
  BUDGET_RANGES,
  INSTITUTION_HINT,
  INSTITUTION_LABEL,
  INSTITUTIONS,
  MAX_NEEDS_CHARS,
  RAMOWY_PLAN_BADGE,
  STAFF_LABEL,
  STAFF_RANGES,
  TIMEFRAME_LABEL,
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
          "mt-2 grid gap-3",
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
    if (!/^\d+$/.test(v)) return "Liczbę osób wpisz cyframi, np. 40 — albo zostaw pole puste.";
    const n = Number(v);
    if (n < 1) return "Liczba osób musi być większa od zera.";
    if (n > 1_000_000) return "Ta liczba jest za duża.";
    return null;
  })();

  const steps: StepperStep[] = [
    {
      id: "innovation",
      title: "Którą innowację chcesz wdrożyć?",
      description:
        "Wybierz rozwiązanie z Biblioteki Innowacji Społecznych ROPS w Krakowie.",
      content: (
        <div>
          {innovation?.ramowyPlan ? (
            <p className="border-brand-accent mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border-2 px-4 py-3">
              <FileCheckIcon aria-hidden="true" className="text-brand-accent size-5" />
              <span className="font-semibold">{RAMOWY_PLAN_BADGE}.</span>
              {innovation.ramowyPlan.sourceUrl ? (
                <ExternalLink
                  href={innovation.ramowyPlan.sourceUrl}
                  className="inline-flex min-h-11 items-center"
                >
                  Ogłoszenie naboru
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
      validate: () =>
        innovation ? null : "Wybierz innowację z listy — zaznacz jedną pozycję.",
    },
    {
      id: "institution",
      title: "Jaka instytucja?",
      description: "Kto poprowadzi usługę? Od tego zależą role i partnerzy w planie.",
      content: (
        <Choices
          legend="Rodzaj instytucji"
          legendClassName="sr-only"
          name={`${id}-institution`}
          options={INSTITUTIONS}
          labels={INSTITUTION_LABEL}
          hints={INSTITUTION_HINT}
          value={answers.institution}
          onChange={(v) => set("institution", v)}
          columns={2}
        />
      ),
      validate: () => (answers.institution ? null : "Wybierz rodzaj instytucji."),
    },
    {
      id: "gmina",
      title: "Gdzie?",
      description:
        "W której gminie ruszy usługa? Do planu wstawimy dane GUS o jej mieszkańcach.",
      content: (
        <GminaCombobox
          options={gminas}
          value={answers.gminaTeryt}
          onChange={(t) => set("gminaTeryt", t)}
          label="Gmina"
          description="Wpisz początek nazwy i wybierz gminę z listy."
        />
      ),
      validate: () => (gmina ? null : "Wybierz gminę z listy podpowiedzi."),
    },
    {
      id: "resources",
      title: "Zasoby i potrzeby",
      description:
        "Odpowiedz orientacyjnie — plan pokaże, co trzeba będzie doprecyzować.",
      content: (
        <div className="space-y-8">
          <Choices
            legend="Ile osób może pracować przy usłudze?"
            name={`${id}-staff`}
            options={STAFF_RANGES}
            labels={STAFF_LABEL}
            value={answers.staff}
            onChange={(v) => set("staff", v)}
            columns={2}
          />
          <Choices
            legend="Orientacyjny budżet usługi"
            name={`${id}-budget`}
            options={BUDGET_RANGES}
            labels={BUDGET_LABEL}
            value={answers.budget}
            onChange={(v) => set("budget", v)}
            columns={2}
          />
          <Choices
            legend="Czas realizacji"
            name={`${id}-timeframe`}
            options={TIMEFRAMES}
            labels={TIMEFRAME_LABEL}
            value={answers.timeframe}
            onChange={(v) => set("timeframe", v)}
          />
          <div>
            <label htmlFor={`${id}-size`} className="block font-semibold">
              Ilu osobom chcesz pomóc? (jeśli wiesz)
            </label>
            <p id={`${id}-size-h`} className="text-muted-foreground text-[0.9375rem]">
              Liczba odbiorców w pierwszym roku. Możesz zostawić puste.
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
              Co jeszcze powinniśmy wiedzieć? (nieobowiązkowo)
            </label>
            <p id={`${id}-needs-h`} className="text-muted-foreground text-[0.9375rem]">
              Na przykład: dla kogo przede wszystkim, jakie macie doświadczenie,
              czego się obawiacie. Nie wpisuj danych osobowych.
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
              {answers.needs.length} / {MAX_NEEDS_CHARS} znaków
            </p>
          </div>
        </div>
      ),
      validate: () => {
        if (!answers.staff) return "Wybierz, ile osób może pracować przy usłudze.";
        if (!answers.budget) return "Wybierz orientacyjny budżet.";
        if (!answers.timeframe) return "Wybierz czas realizacji.";
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
      finishLabel="Przygotuj plan"
      backHref="/library"
      backLabel="Wstecz"
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
