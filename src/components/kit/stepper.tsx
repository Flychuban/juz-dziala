"use client";

import { useTranslations } from "next-intl";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type StepperStep = {
  /** Stable id (used for keys and the autosave position). */
  id: string;
  /** The one question on this screen — rendered as the step heading. */
  title: string;
  /** Optional hint under the question. */
  description?: React.ReactNode;
  /** The field(s) answering the question. Give every field a visible label. */
  content: React.ReactNode;
  /** Return an error message in Polish to block „Dalej", or null to continue. */
  validate?: () => string | null;
};

/**
 * Stepper — one question per screen, the senior pattern for resident forms.
 * Shows „Krok 2 z 4", a progress bar, the question as a heading, and
 * „Wstecz" / „Dalej" (the last step shows `finishLabel`). Enter in a
 * one-line field means „Dalej". Errors are text (role="alert"), never colour
 * alone. Focus moves to the new question after every step change.
 *
 * Works controlled (`step` + `onStepChange`, e.g. for an autosaved draft) or
 * uncontrolled (`initialStep`).
 *
 * @param steps        The screens, in order.
 * @param onFinish     Called on the last step's submit (may be async).
 * @param finishLabel  Last button, e.g. „Wyślij" (default) or „Szukaj rozwiązań".
 * @param backHref     Where „Wstecz" leads from the first step (hidden if omitted).
 * @param busy         Disable the buttons while submitting.
 * @param busyLabel    Text of the last button while busy; defaults to „Wysyłanie…".
 */
export function Stepper({
  steps,
  step: controlledStep,
  initialStep = 0,
  onStepChange,
  onFinish,
  finishLabel,
  nextLabel,
  backLabel,
  backHref,
  busy = false,
  busyLabel,
  className,
}: {
  steps: StepperStep[];
  step?: number;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinish: () => void | Promise<void>;
  finishLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  backHref?: string;
  busy?: boolean;
  busyLabel?: string;
  className?: string;
}) {
  const t = useTranslations("common.kit.stepper");
  finishLabel ??= t("send");
  nextLabel ??= t("next");
  backLabel ??= t("back");
  busyLabel ??= t("sending");
  const [inner, setInner] = useState(initialStep);
  const current = Math.min(
    Math.max(controlledStep ?? inner, 0),
    Math.max(steps.length - 1, 0),
  );
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const errorId = useId();
  const headingId = useId();

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    heading.current?.focus();
  }, [current]);

  const go = (next: number) => {
    setError(null);
    if (controlledStep === undefined) setInner(next);
    onStepChange?.(next);
  };

  const active = steps[current];
  if (!active) return null;
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const percent = Math.round(((current + 1) / steps.length) * 100);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !active) return;
    const form = e.currentTarget;
    const problem = active.validate?.() ?? null;
    if (problem) {
      setError(problem);
      // Move focus to the first field of this step so the person can fix it at once.
      requestAnimationFrame(() => {
        const field = form.querySelector<HTMLElement>(
          "[data-step-content] input, [data-step-content] textarea, [data-step-content] select",
        );
        field?.setAttribute("aria-invalid", "true");
        field?.setAttribute("aria-describedby", errorId);
        field?.focus();
      });
      return;
    }
    setError(null);
    if (isLast) await onFinish();
    else go(current + 1);
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={headingId}
      className={cn("w-full max-w-2xl", className)}
    >
      <div className="mb-6">
        <p className="text-muted-foreground tabular text-base font-semibold">
          {t("progress", { current: current + 1, total: steps.length })}
        </p>
        <div
          aria-hidden="true"
          className="border-hairline bg-surface mt-2 h-2.5 w-full overflow-hidden rounded-sm border"
        >
          <div
            className="bg-primary h-full transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <h2
        id={headingId}
        ref={heading}
        tabIndex={-1}
        className="font-display text-2xl leading-tight font-bold tracking-tight outline-none md:text-3xl"
      >
        {active.title}
      </h2>
      {active.description ? (
        <div className="text-foreground/85 mt-2 text-base">
          {active.description}
        </div>
      ) : null}

      <div className="mt-6" key={active.id} data-step-content>
        {active.content}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="border-destructive text-foreground mt-4 border-l-4 pl-3 font-semibold"
        >
          <span className="text-destructive">{t("attention")} </span>
          {error}
        </p>
      ) : null}

      <div className="border-hairline mt-8 flex flex-wrap-reverse items-center justify-between gap-3 border-t pt-6">
        {isFirst ? (
          backHref ? (
            <Button asChild variant="outline">
              <Link href={backHref}>
                <ArrowLeftIcon aria-hidden="true" />
                {backLabel}
              </Link>
            </Button>
          ) : (
            <span />
          )
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => go(current - 1)}
            disabled={busy}
          >
            <ArrowLeftIcon aria-hidden="true" />
            {backLabel}
          </Button>
        )}
        <Button type="submit" disabled={busy} className="sm:min-w-40">
          {isLast ? (busy ? busyLabel : finishLabel) : nextLabel}
          {!isLast ? <ArrowRightIcon aria-hidden="true" /> : null}
        </Button>
      </div>
    </form>
  );
}
