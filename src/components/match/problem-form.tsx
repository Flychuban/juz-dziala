"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { api } from "~/trpc/react";
import type { GminaOption } from "./format";
import { GminaCombobox } from "./gmina-combobox";
import { btnPrimary, btnSecondary } from "./styles";
import { VoiceInput } from "./voice-input";

export const EXAMPLES = [
  "Mama ma 73 lata, mieszka sama na wsi i prawie nie wychodzi z domu",
  "Nastolatek w kryzysie psychicznym",
  "Osoba niewidoma ma problem z bankomatem",
  "Bezdomny sąsiad potrzebuje pomocy zimą",
] as const;


export function ProblemForm({ gminas }: { gminas: GminaOption[] }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const [gmina, setGmina] = useState<GminaOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ids = { text: useId(), hint: useId(), err: useId() };

  const start = api.match.start.useMutation({
    onSuccess: (view) => {
      utils.match.get.setData({ runId: view.runId }, view);
      router.push(`/match/${view.runId}`);
    },
    onError: (e) => {
      setError(
        e.data?.code === "TOO_MANY_REQUESTS"
          ? "Za dużo wyszukiwań w krótkim czasie. Spróbuj za kilka minut."
          : ((e.data?.zodError?.fieldErrors as Record<string, string[] | undefined> | undefined)?.text?.[0] ??
              "Nie udało się wyszukać. Sprawdź połączenie i spróbuj ponownie."),
      );
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) {
      setError("Opisz problem w kilku słowach.");
      textRef.current?.focus();
      return;
    }
    setError(null);
    start.mutate({ text, ...(gmina ? { gminaTeryt: gmina.teryt } : {}) });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.text} className="text-xl font-semibold">
          Twój opis
        </label>
        <p id={ids.hint} className="text-muted-foreground">
          Opisz własnymi słowami. Nie podawaj nazwisk ani numerów.
        </p>
        <textarea
          id={ids.text}
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={3000}
          aria-describedby={error ? `${ids.hint} ${ids.err}` : ids.hint}
          aria-invalid={error ? true : undefined}
          className="border-input bg-background min-h-40 w-full rounded-lg border-2 px-4 py-3 text-lg"
        />
        {error && (
          <p id={ids.err} role="alert" className="text-destructive font-semibold">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-semibold" id="examples-label">
          Albo zacznij od przykładu:
        </p>
        <ul aria-labelledby="examples-label" className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                className={`${btnSecondary} text-left whitespace-normal`}
                onClick={() => {
                  setText(ex);
                  setError(null);
                  textRef.current?.focus();
                }}
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {gminas.length > 0 && <GminaCombobox options={gminas} value={gmina} onSelect={setGmina} />}

      <div className="flex flex-wrap items-start gap-4">
        <button type="submit" className={btnPrimary} disabled={start.isPending}>
          {start.isPending ? "Szukamy…" : "Szukaj rozwiązań"}
        </button>
        <VoiceInput value={text} onChange={setText} describedBy={ids.hint} />
      </div>
    </form>
  );
}
