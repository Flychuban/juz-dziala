"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { api } from "~/trpc/react";
import type { GminaOption } from "./format";
import { GminaCombobox } from "./gmina-combobox";
import { btnPrimary, btnSecondary } from "./styles";
import { VoiceInput } from "./voice-input";

export const EXAMPLE_KEYS = ["e1", "e2", "e3", "e4"] as const;
export const TEXT_MIN = 3;
export const TEXT_MAX = 3000;

export type FormError = "short" | "long" | "rate" | "failed";

/**
 * The home page form. It works before (and without) JavaScript: it posts to
 * /match/new, which starts the run and redirects to its page; an example chip
 * is a submit button carrying its own text. With JavaScript the same submit
 * runs the tRPC mutation instead, and the button stays disabled („Szukamy…")
 * until the results page has replaced this one, so a double click cannot start
 * two runs.
 */
export function ProblemForm({
  gminas,
  initialError = null,
  initialGmina = null,
}: {
  gminas: GminaOption[];
  initialError?: FormError | null;
  /** Preselected from /?gmina=<TERYT> (a gmina page's „Zgłoś lokalne wyzwanie"). */
  initialGmina?: GminaOption | null;
}) {
  const t = useTranslations("home.form");
  const router = useRouter();
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const [gmina, setGmina] = useState<GminaOption | null>(initialGmina);
  const [error, setError] = useState<FormError | null>(initialError);
  /** Set on submit, cleared only on an error: the page is about to change. */
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ids = { text: useId(), hint: useId(), err: useId(), examples: useId() };

  const start = api.match.start.useMutation({
    onSuccess: (view) => {
      utils.match.get.setData({ runId: view.runId }, view);
      router.push(`/match/${view.runId}`);
    },
    onError: (e, input) => {
      busy.current = false;
      setLeaving(false);
      if (e.data?.code === "TOO_MANY_REQUESTS") setError("rate");
      else if (e.data?.zodError) setError(input.text.trim().length > TEXT_MAX ? "long" : "short");
      else setError("failed");
    },
  });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return;
    // An example chip submits its own text.
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const chip = submitter instanceof HTMLButtonElement && submitter.name === "text" ? submitter.value : null;
    const value = chip ?? text;
    if (chip !== null) setText(chip);
    const length = value.trim().length;
    if (length < TEXT_MIN || length > TEXT_MAX) {
      setError(length < TEXT_MIN ? "short" : "long");
      textRef.current?.focus();
      return;
    }
    busy.current = true;
    setLeaving(true);
    setError(null);
    start.mutate({ text: value, ...(gmina ? { gminaTeryt: gmina.teryt } : {}) });
  };

  const pending = leaving || start.isPending;

  return (
    <form action="/match/new" method="post" onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.text} className="text-xl font-semibold">
          {t("label")}
        </label>
        <p id={ids.hint} className="text-muted-foreground">
          {t("hint")}
        </p>
        <textarea
          id={ids.text}
          ref={textRef}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={TEXT_MAX}
          aria-describedby={error ? `${ids.hint} ${ids.err}` : ids.hint}
          aria-invalid={error === "short" || error === "long" ? true : undefined}
          className="border-input bg-background min-h-40 w-full rounded-lg border-2 px-4 py-3 text-lg"
        />
        {error && (
          <p id={ids.err} role="alert" className="text-destructive font-semibold">
            {t(`errors.${error}`)}
          </p>
        )}
      </div>

      <input type="hidden" name="gmina" value={gmina?.teryt ?? ""} />
      {gminas.length > 0 && <GminaCombobox options={gminas} value={gmina} onSelect={setGmina} />}

      <div className="flex flex-wrap items-start gap-4">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? t("pending") : t("submit")}
        </button>
        <VoiceInput value={text} onChange={setText} describedBy={ids.hint} />
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-semibold" id={ids.examples}>
          {t("examplesLabel")}
        </p>
        <ul aria-labelledby={ids.examples} className="flex flex-wrap gap-2">
          {EXAMPLE_KEYS.map((key) => {
            const example = t(`examples.${key}`);
            return (
              <li key={key}>
                <button
                  type="submit"
                  name="text"
                  value={example}
                  disabled={pending}
                  className={`${btnSecondary} text-left whitespace-normal`}
                >
                  {example}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </form>
  );
}
