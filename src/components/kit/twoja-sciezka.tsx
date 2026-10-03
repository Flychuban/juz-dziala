import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export type PathStep = {
  /** Step name, e.g. „Rozwiązanie", „Działa już w", „Kto pomoże", „Skąd pieniądze". */
  label: string;
  /** The concrete answer for this person, e.g. the innovation title. */
  title: string;
  /** One supporting line (place, organisation, call window …). */
  detail?: string | null;
  /** Where to go next for this step. */
  href?: string | null;
  /** Visible link text when `href` is set; defaults to „Szczegóły". */
  linkLabel?: string;
};

/** The four step names, in order — use these exact words. */
export const PATH_STEP_LABELS = [
  "Rozwiązanie",
  "Działa już w",
  "Kto pomoże",
  "Skąd pieniądze",
] as const;

/**
 * TwojaSciezka — the signature „Twoja ścieżka" strip: an ordered list of
 * connected steps (Rozwiązanie → Działa już w → Kto pomoże → Skąd pieniądze).
 * Vertical with a hairline rail on phones; horizontal from `md` up.
 *
 * @param steps         Usually 4; any 2–5 render well.
 * @param heading       Section heading; defaults to „Twoja ścieżka".
 * @param headingLevel  h2 (default) or h3 to fit the page outline.
 */
export function TwojaSciezka({
  steps,
  heading = "Twoja ścieżka",
  headingLevel = "h2",
  className,
}: {
  steps: PathStep[];
  heading?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const H = headingLevel;
  const cols =
    steps.length >= 5
      ? "md:grid-cols-5"
      : steps.length === 4
        ? "md:grid-cols-4"
        : steps.length === 3
          ? "md:grid-cols-3"
          : "md:grid-cols-2";
  return (
    <section
      data-slot="twoja-sciezka"
      className={cn("border-hairline rounded-lg border p-5 md:p-6", className)}
    >
      <H className="font-display text-xl font-bold tracking-tight">{heading}</H>
      <ol className={cn("mt-5 grid gap-0 md:gap-6", cols)}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li
              key={`${step.label}-${i}`}
              className="relative flex gap-4 pb-7 last:pb-0 md:flex-col md:gap-3 md:pb-0"
            >
              {/* connector rail: vertical on phones, horizontal on md+ */}
              {!last ? (
                <span
                  aria-hidden="true"
                  className="bg-input absolute top-11 bottom-1 left-[1.1875rem] w-px md:top-[1.1875rem] md:right-[-1rem] md:bottom-auto md:left-12 md:h-px md:w-auto"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="border-primary bg-background text-primary font-display tabular relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm font-bold tracking-wide">
                  <span className="sr-only">Krok {i + 1}: </span>
                  {step.label}
                </p>
                <p className="font-display mt-0.5 text-lg leading-snug font-bold">
                  {step.title}
                </p>
                {step.detail ? (
                  <p className="text-foreground/85 mt-1 text-base leading-snug">
                    {step.detail}
                  </p>
                ) : null}
                {step.href ? (
                  <Link
                    href={step.href}
                    className="text-primary mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
                  >
                    {step.linkLabel ?? "Szczegóły"}
                    <span className="sr-only">: {step.label}</span>
                    <ArrowRightIcon aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
