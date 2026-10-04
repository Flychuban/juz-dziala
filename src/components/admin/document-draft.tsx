"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CircleAlertIcon,
  FileTextIcon,
  PencilLineIcon,
  FileSearchIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { SECTION_KEYS, type MapaArea, type SectionKey } from "~/lib/domain";
import { cn } from "~/lib/utils";
import {
  InnovationEditor,
  type DraftFieldView,
  type EditorCard,
} from "./innovation-editor";

type Kind = "pdf" | "text" | "url";

type Draft = {
  title: DraftFieldView;
  sections: Record<SectionKey, DraftFieldView>;
  mapaAreas: MapaArea[];
  keywords: string[];
  videoUrl: string | null;
  warnings: string[];
  source: { kind: Kind; name: string; url: string | null };
};
type Response =
  | { ok: true; draft: Draft; costUsd: number }
  | { ok: false; reason: string; message: string };

const MAX_BYTES = 10 * 1024 * 1024;

const EMPTY: EditorCard = {
  id: null,
  slug: null,
  title: "",
  sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, ""])) as Record<
    SectionKey,
    string
  >,
  mapaAreas: [],
  categories: [],
  keywords: [],
  videoUrl: null,
  testingOpen: false,
  status: "draft",
  sourceUrl: "",
  licence: "",
};

const KINDS = [
  { key: "pdf", label: "kindPdf", hint: "kindPdfHint" },
  { key: "text", label: "kindText", hint: "kindTextHint" },
  { key: "url", label: "kindUrl", hint: "kindUrlHint" },
] as const;

/** „Dodaj z dokumentu": source → AI draft with quotes → editor (or a manual empty form). */
export function DocumentDraft({
  categories,
}: {
  categories: { slug: string; label: string }[];
}) {
  const t = useTranslations("admin.document");
  const locale = useLocale();
  const [kind, setKind] = useState<Kind>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "manual">(
    "idle",
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state === "done" || state === "manual") heading.current?.focus();
  }, [state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const fd = new FormData();
    fd.set("kind", kind);
    if (kind === "pdf") {
      if (!file) return setProblem(t("chooseFile"));
      if (file.size > MAX_BYTES) return setProblem(t("tooBig"));
      fd.set("file", file);
    } else if (kind === "text") {
      if (text.trim().length < 80) return setProblem(t("tooShort"));
      fd.set("text", text);
    } else {
      if (!/^https?:\/\/\S+$/.test(url.trim()))
        return setProblem(t("badUrl"));
      fd.set("url", url.trim());
    }
    setState("loading");
    try {
      const res = await fetch("/admin/library/new/draft", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as Response;
      if (data.ok) {
        setDraft(data.draft);
        setState("done");
      } else {
        setProblem(data.message);
        setState(data.reason === "input" ? "idle" : "manual");
      }
    } catch {
      setProblem(t("network"));
      setState("idle");
    }
  }

  if ((state === "done" && draft) || state === "manual") {
    const initial: EditorCard = draft
      ? {
          ...EMPTY,
          title: draft.title.text,
          sections: Object.fromEntries(
            SECTION_KEYS.map((k) => [k, draft.sections[k].text]),
          ) as Record<SectionKey, string>,
          mapaAreas: draft.mapaAreas,
          keywords: draft.keywords,
          videoUrl: draft.videoUrl,
          sourceUrl: draft.source.url ?? "",
        }
      : {
          // Without AI: keep what the person already gave us.
          ...EMPTY,
          sections: {
            ...EMPTY.sections,
            solution: kind === "text" ? text.trim() : "",
          },
          sourceUrl: kind === "url" ? url.trim() : "",
        };
    return (
      <div>
        <h2
          ref={heading}
          tabIndex={-1}
          className="font-display text-2xl font-bold outline-none"
        >
          {draft ? t("draftHeading") : t("manualHeading")}
        </h2>
        {draft ? (
          <p className="text-foreground/85 mt-2 max-w-[68ch]">
            {t("draftLead", { name: draft.source.name })}
          </p>
        ) : problem ? (
          <Alert variant="warning" role="status" className="mt-4">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{t("noAi")}</AlertTitle>
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        ) : null}
        <div className="mt-8">
          <InnovationEditor
            mode="create"
            initial={initial}
            categories={categories}
            draft={
              draft
                ? {
                    title: draft.title,
                    ...draft.sections,
                    warnings: draft.warnings,
                  }
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-8">
      <fieldset>
        <legend className="font-display text-2xl font-bold">
          {t("source")}
        </legend>
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {KINDS.map((k) => (
            <li key={k.key}>
              <label
                className={cn(
                  "flex h-full min-h-12 cursor-pointer gap-3 rounded-md border p-4",
                  kind === k.key ? "border-primary bg-accent" : "border-input",
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.key}
                  checked={kind === k.key}
                  onChange={() => setKind(k.key)}
                  className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-bold">{t(k.label)}</span>
                  <span className="text-foreground/85 block text-[0.9375rem]">
                    {t(k.hint)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {kind === "pdf" ? (
        <div>
          <p id="doc-file-label" className="block text-lg font-bold">
            {t("fileLabel")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="doc-file"
              type="file"
              accept="application/pdf,.pdf"
              aria-labelledby="doc-file-label doc-file-button"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="peer sr-only"
            />
            <label
              id="doc-file-button"
              htmlFor="doc-file"
              className="border-primary text-primary bg-background hover:bg-accent inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-5 font-semibold peer-focus-visible:shadow-[0_0_0_3px_var(--ring),0_0_0_7px_var(--focus)]"
            >
              <FileTextIcon aria-hidden="true" className="size-5" />
              {t("fileButton")}
            </label>
            <span className="text-[0.9375rem]" aria-live="polite">
              {file
                ? t("fileSize", {
                    name: file.name,
                    size: (file.size / 1024 / 1024).toLocaleString(
                      locale === "en" ? "en-GB" : "pl-PL",
                      { maximumFractionDigits: 1 },
                    ),
                  })
                : t("noFile")}
            </span>
          </div>
        </div>
      ) : kind === "text" ? (
        <div>
          <label htmlFor="doc-text" className="block text-lg font-bold">
            {t("textLabel")}
          </label>
          <Textarea
            id="doc-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-2 min-h-64"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="doc-url" className="block text-lg font-bold">
            {t("urlLabel")}
          </label>
          <Input
            id="doc-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://rops.krakow.pl/…"
            className="mt-2"
          />
        </div>
      )}

      <p className="border-hairline border-l-4 pl-4 text-[0.9375rem]">
        {t("privacy")}
      </p>

      <div aria-live="polite">
        {state === "loading" ? (
          <p className="font-semibold">{t("reading")}</p>
        ) : problem ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{t("fix")}</AlertTitle>
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={state === "loading"}>
          <FileSearchIcon aria-hidden="true" />
          {state === "loading" ? t("preparing") : t("prepare")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            setProblem(null);
            setDraft(null);
            setState("manual");
          }}
        >
          <PencilLineIcon aria-hidden="true" />
          {t("manual")}
        </Button>
      </div>
    </form>
  );
}
