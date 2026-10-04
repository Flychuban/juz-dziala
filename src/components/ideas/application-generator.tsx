"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EyeIcon, FilePenLineIcon, RefreshCwIcon, SendIcon, SparklesIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { INTL_LOCALE, TIME_ZONE } from "~/i18n/config";
import {
  countGaps,
  draftToFields,
  fieldsToMarkdown,
  splitFailure,
  unverifiedNumbers,
  type FormFieldDef,
} from "~/server/ideas/application-rules";
import { gapFor, type ApplicationField, type StoredApplication } from "~/server/ideas/schema";
import { api } from "~/trpc/react";
import { safeStorage, useErrorText } from "./client-utils";
import { TextAreaField } from "./form";
import { usePrivateToken } from "./use-private-token";

type DraftSource = "ai" | "template" | "manual";
type Phase = "idle" | "streaming" | "failed" | "edit" | "sent";

const mdClass =
  "max-w-none text-base leading-relaxed [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2";

type SavedDraft = { fields: ApplicationField[]; source: DraftSource; at: string };

/**
 * The application generator for ONE call: streams a Markdown draft that
 * follows that call's form fields (AI, or the AI-free template when the
 * assistant cannot be reached), then turns it into one editable box per field.
 * Numbers the author never wrote are listed for checking. A draft the
 * assistant broke off is never put into the form — the page says so instead.
 */
export function ApplicationGenerator({
  code,
  token: tokenFromUrl,
  call,
  existing,
  sources,
}: {
  code: string;
  token?: string;
  call: { id: string; name: string; formFields: FormFieldDef[] };
  /** The application already sent for THIS call, if any. */
  existing: StoredApplication | null;
  /** The author's own text and the call's form text — numbers found here are not flagged. */
  sources: string[];
}) {
  const t = useTranslations("ideas.application");
  const locale = useLocale();
  const gap = gapFor(locale);
  const errorText = useErrorText();
  const { token, ready: tokenReady } = usePrivateToken(code, tokenFromUrl);
  const [phase, setPhase] = useState<Phase>(existing ? "edit" : "idle");
  const [markdown, setMarkdown] = useState("");
  const [source, setSource] = useState<DraftSource>(existing?.draftSource ?? "ai");
  const [fields, setFields] = useState<ApplicationField[]>(existing?.fields ?? []);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [sentGaps, setSentGaps] = useState(0);
  const [restored, setRestored] = useState(false);
  const [confirmRedo, setConfirmRedo] = useState(false);
  const storageKey = `jd_application_${code}_${call.id}`;
  const loaded = useRef(false);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const failHeading = useRef<HTMLHeadingElement>(null);
  const confirmText = useRef<HTMLParagraphElement>(null);
  const redoButton = useRef<HTMLButtonElement>(null);
  const submit = api.ideas.submitApplication.useMutation();
  const tq = token ? `?t=${encodeURIComponent(token)}` : "";

  // Restore a draft kept on this device (newer than the one sent to ROPS, if any).
  useEffect(() => {
    const saved = safeStorage.get<SavedDraft>(storageKey);
    const keys = new Set(call.formFields.map((f) => f.key));
    if (
      saved?.fields?.length &&
      saved.fields.every((f) => keys.has(f.key)) &&
      (!existing || saved.at > existing.submittedAt)
    ) {
      setFields(call.formFields.map((f) => ({ key: f.key, label: f.label, value: saved.fields.find((x) => x.key === f.key)?.value ?? "" })));
      setSource(saved.source);
      setPhase("edit");
      setRestored(true);
    }
    loaded.current = true;
  }, [storageKey, call.formFields, existing]);

  // Autosave the generated draft and every edit.
  useEffect(() => {
    if (!loaded.current || phase !== "edit" || fields.length === 0 || fields === existing?.fields) return;
    safeStorage.set(storageKey, { fields, source, at: new Date().toISOString() } satisfies SavedDraft);
  }, [fields, source, phase, storageKey, existing]);

  useEffect(() => {
    if (phase === "edit" && !existing && !restored) editHeading.current?.focus();
    if (phase === "sent") sentHeading.current?.focus();
    if (phase === "failed") failHeading.current?.focus();
  }, [phase, existing, restored]);

  useEffect(() => {
    if (confirmRedo) confirmText.current?.focus();
  }, [confirmRedo]);

  const flagged = useMemo(
    () => (source === "ai" ? unverifiedNumbers(fieldsToMarkdown(fields), [...sources, ...call.formFields.map((f) => `${f.label} ${f.hint ?? ""}`)]) : []),
    [fields, source, sources, call.formFields],
  );

  const submittedAt = existing
    ? new Intl.DateTimeFormat(INTL_LOCALE[locale === "en" ? "en" : "pl"], { dateStyle: "long", timeStyle: "short", timeZone: TIME_ZONE }).format(
        new Date(existing.submittedAt),
      )
    : "";

  async function generate(mode: "auto" | "template" = "auto") {
    setConfirmRedo(false);
    setError("");
    setMarkdown("");
    const before = phase;
    setPhase("streaming");
    try {
      const res = await fetch("/api/ideas/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token, callId: call.id, mode }),
      });
      if (!res.ok || !res.body) {
        setError((await res.text()) || t("failedGeneric"));
        setPhase(before === "edit" || fields.length ? "edit" : "idle");
        return;
      }
      const kind: DraftSource = res.headers.get("X-Draft-Source") === "template" ? "template" : "ai";
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setMarkdown(splitFailure(text).text);
      }
      text += dec.decode();
      const result = splitFailure(text);
      if (result.failed || !result.text.trim()) {
        // The assistant stopped mid-way: nothing goes into the form, and nothing is called ready.
        setMarkdown("");
        setPhase("failed");
        return;
      }
      setSource(kind);
      setFields(draftToFields(result.text, call.formFields, gap));
      setRestored(false);
      setPhase("edit");
      requestAnimationFrame(() => editHeading.current?.focus());
    } catch (e) {
      setMarkdown("");
      setError(errorText(e));
      setPhase("failed");
    }
  }

  function startEmpty() {
    setSource("manual");
    setFields(call.formFields.map((f) => ({ key: f.key, label: f.label, value: "" })));
    setPhase("edit");
  }

  async function send() {
    setError("");
    try {
      const res = await submit.mutateAsync({ code, token, callId: call.id, fields, draftSource: source });
      setSentGaps(res.gaps);
      safeStorage.remove(storageKey);
      setRestored(false);
      setPhase("sent");
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (phase === "sent") {
    return (
      <section aria-labelledby="sent-h" className="border-hairline border-t-4 pt-6">
        <h2 id="sent-h" ref={sentHeading} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
          {t("sent.heading")}
        </h2>
        <p className="mt-2 text-lg">
          {t("sent.body", { code })} {sentGaps ? t("sent.gaps", { count: sentGaps }) : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/case/${code}${tq}`}>{t("sent.toCase")}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setPhase("edit")}>
            {t("sent.edit")}
          </Button>
        </div>
      </section>
    );
  }

  const readOnlyNote =
    tokenReady && !token ? (
      <div role="note" className="border-hairline border-l-4 py-1 pl-4">
        <p className="font-semibold">{t("readOnly.title")}</p>
        <p className="mt-1">{t("readOnly.body")}</p>
      </div>
    ) : null;

  if (phase !== "edit") {
    return (
      <section aria-labelledby="gen-h" className="flex flex-col gap-4">
        <h2 id="gen-h" className="font-display text-2xl font-bold">
          {t("gen.heading")}
        </h2>
        <p>{t("gen.body", { gap })}</p>
        {readOnlyNote}
        {phase === "failed" ? (
          <div role="alert" className="border-destructive border-l-4 pl-4">
            <h3 ref={failHeading} tabIndex={-1} className="text-lg font-semibold outline-none">
              {t("failed.heading")}
            </h3>
            <p className="mt-1">{error || t("failed.body")}</p>
          </div>
        ) : error ? (
          <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void generate()} disabled={phase === "streaming"}>
            <SparklesIcon aria-hidden="true" />
            {phase === "streaming" ? t("gen.writing") : phase === "failed" ? t("failed.retry") : t("gen.start")}
          </Button>
          {phase === "failed" ? (
            <Button type="button" variant="outline" onClick={() => void generate("template")}>
              <FilePenLineIcon aria-hidden="true" />
              {t("failed.template")}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={startEmpty} disabled={phase === "streaming"}>
              <FilePenLineIcon aria-hidden="true" />
              {t("gen.empty")}
            </Button>
          )}
        </div>
        {phase === "streaming" ? (
          <div className="border-hairline bg-surface mt-2 rounded-md border p-4" aria-busy="true">
            <p role="status" className="text-muted-foreground mb-2 text-sm font-semibold">
              {t("gen.wait")}
            </p>
            <div className={mdClass}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} unwrapDisallowed>
                {markdown || "…"}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const gaps = countGaps(fields);
  return (
    <section aria-labelledby="edit-h" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 id="edit-h" ref={editHeading} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
          {t("edit.heading")}
        </h2>
        {restored ? <p role="status">{t("edit.restored")}</p> : null}
        {existing?.fields === fields ? <p>{t("edit.sentBefore", { date: submittedAt })}</p> : null}
        {source === "template" ? (
          <div role="note" className="border-hairline border-l-4 py-1 pl-4">
            <p className="font-semibold">{t("edit.templateTitle")}</p>
            <p className="mt-1">{t("edit.templateBody", { gap })}</p>
          </div>
        ) : null}
        {source === "ai" ? <p className="text-muted-foreground text-sm">{t("edit.aiNote")}</p> : null}
        {readOnlyNote}
        <p role="status" className="text-lg font-semibold">
          {gaps === 0 ? t("edit.gapsNone") : t("edit.gaps", { count: gaps, gap })}
        </p>
        {flagged.length ? (
          <div role="note" className="border-hairline bg-warning-bg rounded-md border border-l-4 p-4">
            <p className="font-semibold">{t("edit.flaggedTitle")}</p>
            <p className="mt-1">{t("edit.flaggedBody", { numbers: flagged.join(", ") })}</p>
          </div>
        ) : null}
      </div>

      {fields.map((f, i) => (
        <TextAreaField
          key={f.key}
          label={`${i + 1}. ${f.label}`}
          hint={call.formFields.find((x) => x.key === f.key)?.hint ?? undefined}
          value={f.value}
          onChange={(v) => setFields((all) => all.map((x) => (x.key === f.key ? { ...x, value: v } : x)))}
          maxLength={8000}
          rows={5}
          required
        />
      ))}

      <details className="border-hairline border-y py-2" open={preview} onToggle={(e) => setPreview((e.target as HTMLDetailsElement).open)}>
        <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold">
          <EyeIcon aria-hidden="true" className="size-5" />
          {t("edit.preview")}
        </summary>
        {preview ? (
          <div className={`${mdClass} mt-2`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} unwrapDisallowed>
              {fieldsToMarkdown(fields.map((f) => ({ ...f, value: f.value || gap })))}
            </ReactMarkdown>
          </div>
        ) : null}
      </details>

      {error ? (
        <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
          <span className="text-destructive">{t("edit.notSent")} </span>
          {error}
        </p>
      ) : null}

      {confirmRedo ? (
        <div className="border-hairline border-l-4 py-1 pl-4">
          <p ref={confirmText} tabIndex={-1} className="font-semibold outline-none">
            {t("redo.question")}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" variant="destructive" onClick={() => void generate()}>
              <RefreshCwIcon aria-hidden="true" />
              {t("redo.confirm")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmRedo(false);
                requestAnimationFrame(() => redoButton.current?.focus());
              }}
            >
              {t("redo.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-hairline flex flex-wrap gap-3 border-t pt-6">
        {token ? (
          <Button type="button" onClick={() => void send()} disabled={submit.isPending}>
            <SendIcon aria-hidden="true" />
            {submit.isPending ? t("edit.sending") : t("edit.send")}
          </Button>
        ) : null}
        <Button
          ref={redoButton}
          type="button"
          variant="outline"
          onClick={() => setConfirmRedo(true)}
          disabled={submit.isPending || confirmRedo}
          aria-expanded={confirmRedo}
        >
          <SparklesIcon aria-hidden="true" />
          {t("edit.redo")}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t("edit.notTheCall")}</p>
    </section>
  );
}
