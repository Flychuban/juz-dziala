"use client";

import { useId } from "react";

import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

/**
 * Form building blocks for the resident forms of modules III–V: big choice
 * cards (native radios/checkboxes inside ≥ 48 px labels — the state is the
 * control itself, never colour alone), labelled text fields with a hint and a
 * character counter. Every control has a visible label.
 */

export type Choice<T extends string> = { value: T; label: string; description?: string | null };

const cardClass =
  "border-input bg-background hover:bg-surface has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-focus flex min-h-12 cursor-pointer items-start gap-3 rounded-md border-2 px-4 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2";

/** One answer of many, as large cards. */
export function ChoiceCards<T extends string>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
  columns = 1,
  legendClassName,
}: {
  legend: string;
  hint?: React.ReactNode;
  name: string;
  options: readonly Choice<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  columns?: 1 | 2;
  legendClassName?: string;
}) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint ? hintId : undefined} className="min-w-0">
      <legend className={cn("mb-2 text-lg font-semibold", legendClassName)}>{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-muted-foreground mb-3">
          {hint}
        </p>
      ) : null}
      <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => (
          <label key={o.value} className={cardClass}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="accent-primary mt-0.5 size-6 shrink-0"
            />
            <span>
              <span className="block text-base font-semibold">{o.label}</span>
              {o.description ? <span className="text-muted-foreground block text-[0.9375rem]">{o.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Several answers, as large cards. */
export function CheckCards<T extends string>({
  legend,
  hint,
  options,
  values,
  onChange,
  columns = 2,
  legendClassName,
}: {
  legend: string;
  hint?: React.ReactNode;
  options: readonly Choice<T>[];
  values: readonly T[];
  onChange: (v: T[]) => void;
  columns?: 1 | 2;
  legendClassName?: string;
}) {
  const hintId = useId();
  const toggle = (v: T) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <fieldset aria-describedby={hint ? hintId : undefined} className="min-w-0">
      <legend className={cn("mb-2 text-lg font-semibold", legendClassName)}>{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-muted-foreground mb-3">
          {hint}
        </p>
      ) : null}
      <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => (
          <label key={o.value} className={cardClass}>
            <input
              type="checkbox"
              value={o.value}
              checked={values.includes(o.value)}
              onChange={() => toggle(o.value)}
              className="accent-primary mt-0.5 size-6 shrink-0"
            />
            <span>
              <span className="block text-base font-semibold">{o.label}</span>
              {o.description ? <span className="text-muted-foreground block text-[0.9375rem]">{o.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A single checkbox with a long label. */
export function CheckLine({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className={cardClass}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary mt-0.5 size-6 shrink-0" />
      <span>
        <span className="block text-base font-semibold">{label}</span>
        {description ? <span className="text-muted-foreground block text-[0.9375rem]">{description}</span> : null}
      </span>
    </label>
  );
}

/** Labelled one-line input with an optional hint. */
export function TextField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  type = "text",
  autoComplete,
  inputMode,
  required,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-lg font-semibold">
        {label}
        {required ? null : <span className="text-muted-foreground font-normal"> (nieobowiązkowe)</span>}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="text-lg"
      />
    </div>
  );
}

/** Labelled textarea with a hint and a „zostało N znaków" counter. */
export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  rows = 5,
  required = true,
  labelClassName,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  rows?: number;
  required?: boolean;
  labelClassName?: string;
  className?: string;
}) {
  const id = useId();
  const left = maxLength - value.length;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className={cn("text-lg font-semibold", labelClassName)}>
        {label}
        {required ? null : <span className="text-muted-foreground font-normal"> (nieobowiązkowe)</span>}
      </label>
      {hint ? (
        <div id={`${id}-hint`} className="text-muted-foreground">
          {hint}
        </div>
      ) : null}
      <Textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-describedby={[hint ? `${id}-hint` : "", `${id}-count`].filter(Boolean).join(" ")}
        onChange={(e) => onChange(e.target.value)}
        className="text-lg"
      />
      <p id={`${id}-count`} className="text-muted-foreground tabular text-sm">
        {left < 200 ? `Zostało ${left} znaków.` : `Maksymalnie ${maxLength} znaków.`}
      </p>
    </div>
  );
}
