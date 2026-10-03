"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DownloadIcon,
  FileTextIcon,
  PencilIcon,
  PrinterIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";

import { ExternalLink } from "~/components/kit/external-link";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  PLAN_DISCLAIMER,
  PLAN_MODE_HEADER,
  RAMOWY_PLAN_BADGE,
  type PlanInputs,
  type PlanMode,
} from "~/server/adapt/options";
import { PlanMarkdown } from "./plan-markdown";
import { SupportRequest } from "./support-request";

type Status = "streaming" | "done" | "error";

/** A4 print: only the plan, with room for the margin notes ROPS will add. */
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 16mm 14mm; }
  [data-slot="page-header"] { display: none !important; }
  [data-plan-print] { font-size: 11pt; line-height: 1.45; }
  [data-plan-print] blockquote { border-left: 3px solid #000; }
}`;

function slugify(s: string) {
  return s
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Streams the Ramowy Plan Wdrożenia from /api/adapt/plan and renders it as
 * it arrives; then offers print, a .md download and „send to ROPS". Focus
 * moves to the plan heading; progress is announced in a polite status line
 * (never the whole growing text).
 */
export function PlanView({
  inputs,
  innovation,
  gminaName,
  onEdit,
}: {
  inputs: PlanInputs;
  innovation: {
    slug: string;
    title: string;
    ramowyPlan: { callName: string; sourceUrl: string | null } | null;
  };
  gminaName: string;
  onEdit: () => void;
}) {
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<Status>("streaming");
  const [mode, setMode] = useState<PlanMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const inputsKey = JSON.stringify(inputs);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setMarkdown("");
    setStatus("streaming");
    setError(null);
    setMode(null);
    void (async () => {
      try {
        const res = await fetch("/api/adapt/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: inputsKey,
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let message = "Nie udało się przygotować planu. Spróbuj ponownie.";
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) message = j.error;
          } catch {
            /* keep the generic message */
          }
          setError(message);
          setStatus("error");
          return;
        }
        setMode(res.headers.get(PLAN_MODE_HEADER) === "ai" ? "ai" : "template");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          setMarkdown(text);
        }
        text += dec.decode();
        setMarkdown(text);
        setStatus("done");
      } catch (e) {
        if (ctrl.signal.aborted) return;
        console.error(e);
        setError("Połączenie zostało przerwane. Spróbuj ponownie.");
        setStatus("error");
      }
    })();
    return () => ctrl.abort();
  }, [inputsKey, run]);

  const download = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ramowy-plan-wdrozenia-${slugify(innovation.title)}-${slugify(gminaName)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [markdown, innovation.title, gminaName]);

  return (
    <div className="w-full">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-wrap items-start justify-between gap-4" data-no-print>
        <div>
          <h2
            ref={heading}
            tabIndex={-1}
            className="font-display text-2xl leading-tight font-bold tracking-tight outline-none md:text-3xl"
          >
            Twój Ramowy Plan Wdrożenia
          </h2>
          <p className="text-foreground/85 mt-1">
            „{innovation.title}” · {gminaName}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onEdit}>
          <PencilIcon aria-hidden="true" />
          Zmień odpowiedzi
        </Button>
      </div>

      <Alert variant="warning" role="note" className="mt-6" data-no-print>
        <FileTextIcon aria-hidden="true" />
        <AlertTitle>{PLAN_DISCLAIMER}.</AlertTitle>
        <AlertDescription>
          Liczby o gminie pochodzą z GUS, cytaty — z karty innowacji, nabory —
          z ogłoszeń ROPS. Miejsca oznaczone „[DO UZUPEŁNIENIA]” uzupełnia
          Twoja instytucja, a kwoty budżetu są orientacyjne i „do weryfikacji”.
        </AlertDescription>
      </Alert>

      {innovation.ramowyPlan ? (
        <p
          className="border-brand-accent mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border-2 px-4 py-3 font-semibold"
          data-no-print
        >
          <span>{RAMOWY_PLAN_BADGE}.</span>
          {innovation.ramowyPlan.sourceUrl ? (
            <ExternalLink
              href={innovation.ramowyPlan.sourceUrl}
              className="inline-flex min-h-11 items-center font-normal"
            >
              Zobacz ogłoszenie naboru
            </ExternalLink>
          ) : null}
        </p>
      ) : null}

      <p role="status" className="mt-4 min-h-6 font-semibold" data-no-print>
        {status === "streaming"
          ? mode === "ai"
            ? "Asystent AI przygotowuje plan…"
            : "Przygotowuję plan…"
          : status === "done"
            ? "Plan gotowy. Możesz go wydrukować, pobrać albo wysłać do ROPS."
            : ""}
      </p>
      {mode ? (
        <p
          className="text-muted-foreground flex items-center gap-2 text-[0.9375rem]"
          data-no-print
        >
          {mode === "ai" ? (
            <>
              <SparklesIcon aria-hidden="true" className="size-4" />
              Opis przygotował Asystent AI; liczby, budżet i nabory wstawił
              system z danych źródłowych.
            </>
          ) : (
            <>
              <FileTextIcon aria-hidden="true" className="size-4" />
              Plan z szablonu — bez udziału AI. Wszystkie części wypełniono z
              karty innowacji, danych GUS i ogłoszeń ROPS.
            </>
          )}
        </p>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="border-destructive mt-4 border-l-4 pl-3">
          <p className="font-semibold">
            <span className="text-destructive">Błąd: </span>
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => setRun((r) => r + 1)}
          >
            <RefreshCwIcon aria-hidden="true" />
            Spróbuj ponownie
          </Button>
        </div>
      ) : null}

      {markdown ? (
        <article
          aria-label="Ramowy Plan Wdrożenia"
          aria-busy={status === "streaming"}
          data-plan-print
          className="border-hairline mt-6 rounded-lg border p-5 md:p-8 print:border-0 print:p-0"
        >
          <PlanMarkdown markdown={markdown} />
        </article>
      ) : status === "streaming" ? (
        <div
          aria-hidden="true"
          className="border-hairline mt-6 space-y-3 rounded-lg border p-5 md:p-8"
        >
          <div className="bg-surface h-8 w-2/3 rounded" />
          <div className="bg-surface h-4 w-full rounded" />
          <div className="bg-surface h-4 w-5/6 rounded" />
        </div>
      ) : null}

      {status === "done" ? (
        <div className="mt-8 space-y-8" data-no-print>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => window.print()}>
              <PrinterIcon aria-hidden="true" />
              Drukuj plan
            </Button>
            <Button type="button" variant="secondary" onClick={download}>
              <DownloadIcon aria-hidden="true" />
              Pobierz jako tekst (.md)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRun((r) => r + 1)}
            >
              <RefreshCwIcon aria-hidden="true" />
              Przygotuj ponownie
            </Button>
          </div>
          <SupportRequest
            inputs={inputs}
            markdown={markdown}
            mode={mode ?? "template"}
          />
        </div>
      ) : null}
    </div>
  );
}
