"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  PLAN_MODE_HEADER,
  readPlanSource,
  type PlanInputs,
  type PlanSource,
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
 * it arrives; then offers „send to ROPS" (the main action), print and a .md
 * download. Focus moves to the plan heading; progress is announced in a
 * polite status line (never the whole growing text).
 *
 * Who wrote the plan is said only once it is known: the response header tells
 * whether the AI was asked at all, and an AI response ends with the final
 * source (ai / mixed / template) — so the page never credits the Asystent AI
 * with sections that came from the template.
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
    lang?: "pl" | "en";
    ramowyPlan: { callName: string; sourceUrl: string | null } | null;
  };
  gminaName: string;
  onEdit: () => void;
}) {
  const t = useTranslations("adapt.view");
  const tb = useTranslations("adapt");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<Status>("streaming");
  const [attempt, setAttempt] = useState<"ai" | "template" | null>(null);
  const [source, setSource] = useState<PlanSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const inputsKey = JSON.stringify(inputs);
  const genericError = t("errorGeneric");
  const connectionError = t("errorConnection");

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setMarkdown("");
    setStatus("streaming");
    setError(null);
    setAttempt(null);
    setSource(null);
    void (async () => {
      try {
        const res = await fetch("/api/adapt/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: inputsKey,
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let message = genericError;
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
        const tried = res.headers.get(PLAN_MODE_HEADER) === "ai" ? "ai" : "template";
        setAttempt(tried);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          setMarkdown(readPlanSource(text).markdown);
        }
        text += dec.decode();
        const final = readPlanSource(text);
        setMarkdown(final.markdown);
        setSource(tried === "template" ? "template" : final.source);
        setStatus("done");
      } catch (e) {
        if (ctrl.signal.aborted) return;
        console.error(e);
        setError(connectionError);
        setStatus("error");
      }
    })();
    return () => ctrl.abort();
  }, [inputsKey, run, genericError, connectionError]);

  const fileStem = t("fileStem");
  const download = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileStem}-${slugify(innovation.title)}-${slugify(gminaName)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [markdown, innovation.title, gminaName, fileStem]);

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
            {t("heading")}
          </h2>
          <p className="text-foreground/85 mt-1">
            <span lang={innovation.lang === "pl" ? "pl" : undefined}>
              {t("quoted", { title: innovation.title })}
            </span>{" "}
            · {gminaName}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onEdit}>
          <PencilIcon aria-hidden="true" />
          {t("edit")}
        </Button>
      </div>

      <Alert variant="warning" role="note" className="mt-6" data-no-print>
        <FileTextIcon aria-hidden="true" />
        <AlertTitle>{tb("disclaimer")}.</AlertTitle>
        <AlertDescription>{t("note")}</AlertDescription>
      </Alert>

      {innovation.ramowyPlan ? (
        <p
          className="border-brand-accent mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 py-1 pl-4 font-semibold"
          data-no-print
        >
          <span>{tb("ramowyBadge")}.</span>
          {innovation.ramowyPlan.sourceUrl ? (
            <ExternalLink
              href={innovation.ramowyPlan.sourceUrl}
              className="inline-flex min-h-11 items-center font-normal"
            >
              {t("callLink")}
            </ExternalLink>
          ) : null}
        </p>
      ) : null}

      <p role="status" className="mt-4 min-h-6 font-semibold" data-no-print>
        {status === "streaming"
          ? attempt === "ai"
            ? t("streamingAi")
            : t("streaming")
          : status === "done"
            ? t("done")
            : ""}
      </p>
      {status === "done" && source ? (
        <p
          className="text-muted-foreground flex items-start gap-2 text-[0.9375rem]"
          data-no-print
        >
          {source === "template" ? (
            <FileTextIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          ) : (
            <SparklesIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{t(`source.${source}`)}</span>
        </p>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="border-destructive mt-4 border-l-4 pl-3">
          <p className="font-semibold">
            <span className="text-destructive">{t("errorPrefix")} </span>
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => setRun((r) => r + 1)}
          >
            <RefreshCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      ) : null}

      {markdown ? (
        <article
          aria-label={t("articleLabel")}
          aria-busy={status === "streaming"}
          data-plan-print
          className="border-hairline mt-6 border-t pt-2 print:border-0 print:pt-0"
        >
          <PlanMarkdown markdown={markdown} />
        </article>
      ) : status === "streaming" ? (
        <div aria-hidden="true" className="border-hairline mt-6 space-y-3 border-t pt-6">
          <div className="bg-surface h-8 w-2/3 rounded" />
          <div className="bg-surface h-4 w-full rounded" />
          <div className="bg-surface h-4 w-5/6 rounded" />
        </div>
      ) : null}

      {status === "done" ? (
        <div className="border-hairline mt-10 space-y-8 border-t pt-8" data-no-print>
          <SupportRequest
            inputs={inputs}
            markdown={markdown}
            mode={source ?? (attempt === "ai" ? "mixed" : "template")}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <PrinterIcon aria-hidden="true" />
              {t("print")}
            </Button>
            <Button type="button" variant="outline" onClick={download}>
              <DownloadIcon aria-hidden="true" />
              {t("download")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRun((r) => r + 1)}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("again")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
