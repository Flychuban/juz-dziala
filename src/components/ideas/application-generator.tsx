"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EyeIcon, FilePenLineIcon, SendIcon, SparklesIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { draftToFields, fieldsToMarkdown, unverifiedNumbers, type FormFieldDef } from "~/server/ideas/application-rules";
import { GAP, type ApplicationField, type StoredApplication } from "~/server/ideas/schema";
import { api } from "~/trpc/react";
import { errorText } from "./client-utils";
import { TextAreaField } from "./form";

type DraftSource = "ai" | "template" | "manual";

const mdClass =
  "max-w-none text-base leading-relaxed [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2";

function countGaps(fields: readonly ApplicationField[]) {
  return fields.filter((f) => !f.value.trim() || f.value.includes(GAP)).length;
}

/**
 * The application generator: streams a Markdown draft (AI, or the AI-free
 * template when the assistant is unavailable), then turns it into one editable
 * box per form field. Numbers the author never wrote are listed for checking.
 */
export function ApplicationGenerator({
  code,
  token,
  call,
  existing,
  sources,
}: {
  code: string;
  token?: string;
  call: { id: string; name: string; formFields: FormFieldDef[] };
  existing: StoredApplication | null;
  /** The author's own text and the call's form text — numbers found here are not flagged. */
  sources: string[];
}) {
  const [phase, setPhase] = useState<"idle" | "streaming" | "edit" | "sent">(existing ? "edit" : "idle");
  const [markdown, setMarkdown] = useState("");
  const [source, setSource] = useState<DraftSource>(existing?.draftSource ?? "ai");
  const [fields, setFields] = useState<ApplicationField[]>(existing?.fields ?? []);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [sentGaps, setSentGaps] = useState(0);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const submit = api.ideas.submitApplication.useMutation();
  const t = token ? `?t=${encodeURIComponent(token)}` : "";

  useEffect(() => {
    if (phase === "edit" && !existing) editHeading.current?.focus();
    if (phase === "sent") sentHeading.current?.focus();
  }, [phase, existing]);

  const flagged = useMemo(
    () => (source === "ai" ? unverifiedNumbers(fieldsToMarkdown(fields), [...sources, ...call.formFields.map((f) => `${f.label} ${f.hint ?? ""}`)]) : []),
    [fields, source, sources, call.formFields],
  );

  async function generate() {
    setError("");
    setMarkdown("");
    setPhase("streaming");
    try {
      const res = await fetch("/api/ideas/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token }),
      });
      if (!res.ok || !res.body) {
        setError((await res.text()) || "Nie udało się przygotować szkicu.");
        setPhase(fields.length ? "edit" : "idle");
        return;
      }
      const kind = res.headers.get("X-Draft-Source") === "template" ? "template" : "ai";
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
      setSource(kind);
      setFields(draftToFields(text, call.formFields));
      setPhase("edit");
    } catch (e) {
      setError(errorText(e));
      setPhase(fields.length ? "edit" : "idle");
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
      setPhase("sent");
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (phase === "sent") {
    return (
      <section aria-labelledby="sent-h" className="border-hairline rounded-lg border-2 p-6">
        <h2 id="sent-h" ref={sentHeading} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
          Wniosek wysłany do ROPS
        </h2>
        <p className="mt-2 text-lg">
          Treść wniosku jest w wątku sprawy {code}. {sentGaps ? `Zostało ${sentGaps} pól do uzupełnienia — zespół ROPS pomoże Ci je dokończyć.` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/case/${code}${t}`}>Przejdź do sprawy</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setPhase("edit")}>
            Popraw wniosek
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {phase !== "edit" ? (
        <section aria-labelledby="gen-h" className="border-hairline rounded-lg border p-6">
          <h2 id="gen-h" className="font-display text-2xl font-bold">
            Szkic wniosku
          </h2>
          <p className="mt-2">
            Wypełnimy pola formularza na podstawie Twojej fiszki i Canvasu. Tego, czego tam nie ma — kwot, terminów, partnerów — nie wymyślamy: w tych
            miejscach zobaczysz „{GAP}”.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => void generate()} disabled={phase === "streaming"}>
              <SparklesIcon aria-hidden="true" />
              {phase === "streaming" ? "Piszemy szkic…" : "Przygotuj szkic wniosku"}
            </Button>
            <Button type="button" variant="outline" onClick={startEmpty} disabled={phase === "streaming"}>
              <FilePenLineIcon aria-hidden="true" />
              Wypełnię sam(a) od zera
            </Button>
          </div>
          {error ? (
            <p role="alert" className="border-destructive mt-4 border-l-4 pl-3 font-semibold">
              {error}
            </p>
          ) : null}
          {phase === "streaming" || markdown ? (
            <div className="border-hairline bg-surface mt-6 rounded-md border p-4" aria-busy={phase === "streaming"}>
              <p role="status" className="text-muted-foreground mb-2 text-sm font-semibold">
                {phase === "streaming" ? "Piszemy szkic — to może potrwać do minuty." : "Szkic gotowy."}
              </p>
              <div className={mdClass}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} unwrapDisallowed>{markdown || "…"}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section aria-labelledby="edit-h" className="flex flex-col gap-6">
          <div>
            <h2 id="edit-h" ref={editHeading} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
              Sprawdź i popraw wniosek
            </h2>
            {existing?.fields === fields ? (
              <p className="mt-2">
                Wysłałaś/eś ten wniosek {new Date(existing.submittedAt).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" })}. Możesz go
                poprawić i wysłać ponownie.
              </p>
            ) : null}
            {source === "template" ? (
              <div role="note" className="border-hairline bg-surface mt-3 rounded-md border border-l-4 p-4">
                <p className="font-semibold">Asystent AI chwilowo niedostępny</p>
                <p className="mt-1">Przygotowaliśmy szablon z Twojej fiszki i Canvasu. Uzupełnij pola oznaczone „{GAP}”.</p>
              </div>
            ) : null}
            {source === "ai" ? (
              <p className="text-muted-foreground mt-2 text-sm">Szkic napisała sztuczna inteligencja na podstawie Twoich danych. Przeczytaj go uważnie przed wysłaniem.</p>
            ) : null}
            <p role="status" aria-live="polite" className="mt-3 text-lg font-semibold">
              Do uzupełnienia: {countGaps(fields)} z {fields.length} pól.
            </p>
            {flagged.length ? (
              <div role="note" className="border-hairline bg-warning-bg mt-3 rounded-md border border-l-4 p-4">
                <p className="font-semibold">Do weryfikacji: liczby, których nie ma w Twojej fiszce</p>
                <p className="mt-1">
                  {flagged.join(", ")} — sprawdź, skąd się wzięły, i popraw albo usuń je przed wysłaniem.
                </p>
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
              required={false}
            />
          ))}

          <details className="border-hairline rounded-md border p-4" open={preview} onToggle={(e) => setPreview((e.target as HTMLDetailsElement).open)}>
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold">
              <EyeIcon aria-hidden="true" className="size-5" />
              Podgląd całego wniosku
            </summary>
            {preview ? (
              <div className={`${mdClass} mt-2`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} unwrapDisallowed>{fieldsToMarkdown(fields.map((f) => ({ ...f, value: f.value || GAP })))}</ReactMarkdown>
              </div>
            ) : null}
          </details>

          {error ? (
            <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
              <span className="text-destructive">Nie wysłano: </span>
              {error}
            </p>
          ) : null}
          <div className="border-hairline flex flex-wrap gap-3 border-t pt-6">
            <Button type="button" onClick={() => void send()} disabled={submit.isPending}>
              <SendIcon aria-hidden="true" />
              {submit.isPending ? "Wysyłanie…" : "Wyślij wniosek do ROPS"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void generate()} disabled={submit.isPending}>
              <SparklesIcon aria-hidden="true" />
              Przygotuj szkic od nowa
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Wysłanie przekazuje szkic zespołowi ROPS w Twojej sprawie. To nie jest złożenie wniosku w naborze — wniosek składasz w formularzu elektronicznym
            naboru.
          </p>
        </section>
      )}
    </div>
  );
}
