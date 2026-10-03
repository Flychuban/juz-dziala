"use client";

import { useEffect, useRef, useState } from "react";
import { PrinterIcon, SaveIcon } from "lucide-react";

import { formatDatePl } from "~/components/kit";
import { Button } from "~/components/ui/button";
import {
  IMPACT_DIMENSIONS,
  notesKey,
  type CanvasDef,
  type CanvasField,
  type CanvasSection,
} from "~/server/ideas/canvas-def";
import type { CanvasValues } from "~/server/ideas/schema";
import { api } from "~/trpc/react";
import { errorText, safeStorage } from "./client-utils";
import { CheckCards, ChoiceCards, TextAreaField } from "./form";

/** „PROBLEM" → „Problem": all-caps labels are hard to read and spelled out by screen readers. */
export function sentenceCase(label: string): string {
  if (label !== label.toUpperCase()) return label;
  const lower = label.toLocaleLowerCase("pl-PL");
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}

function sheetHeading(def: CanvasDef, i: number) {
  return `Arkusz ${i + 1} z ${def.sheets.length}`;
}

/** The impact matrix questions are „Osoba — Jak zmienia…"; split them per dimension. */
function dimensionQuestion(field: CanvasField, dim: string): string | undefined {
  return field.questions.find((q) => q.startsWith(dim))?.replace(/^[^—]+—\s*/, "");
}

function FieldEditor({
  field,
  values,
  onNotes,
  onPicks,
}: {
  field: CanvasField;
  values: CanvasValues;
  onNotes: (key: string, v: string) => void;
  onPicks: (key: string, v: string[]) => void;
}) {
  const hint =
    field.prompt || field.questions.length ? (
      <>
        {field.prompt ? <p>{field.prompt}</p> : null}
        {field.kind !== "matrix" && field.questions.length ? (
          <ul className="mt-1 list-disc pl-5">
            {field.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        ) : null}
      </>
    ) : null;

  if (field.key === "partnerStatus") {
    return (
      <div>
        <p className="text-lg font-semibold">{field.label}</p>
        <p className="text-muted-foreground">
          {field.prompt ?? "Przy każdym partnerze dopisz, jaki ma status:"} {field.options.map((o) => o.label.toLocaleLowerCase("pl-PL")).join(", ")}.
        </p>
      </div>
    );
  }
  if (field.kind === "text") {
    return (
      <TextAreaField
        label={field.label}
        hint={hint}
        value={values.notes[field.key] ?? ""}
        onChange={(v) => onNotes(field.key, v)}
        maxLength={4000}
        rows={4}
        required={false}
      />
    );
  }
  if (field.kind === "single") {
    return (
      <div className="flex flex-col gap-2">
        <ChoiceCards
          legend={field.label}
          hint={hint}
          name={field.key}
          options={field.options.map((o) => ({ value: o.label, label: o.label, description: o.description }))}
          value={values.picks[field.key]?.[0] ?? null}
          onChange={(v) => onPicks(field.key, [v])}
          columns={2}
        />
        {values.picks[field.key]?.length ? (
          <Button type="button" variant="link" className="w-fit px-0" onClick={() => onPicks(field.key, [])}>
            Wyczyść wybór: {field.label}
          </Button>
        ) : null}
      </div>
    );
  }
  if (field.kind === "multi") {
    return (
      <CheckCards
        legend={field.label}
        hint={hint}
        options={field.options.map((o) => ({ value: o.label, label: o.label, description: o.description }))}
        values={values.picks[field.key] ?? []}
        onChange={(v) => onPicks(field.key, v)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {field.prompt ? <p className="text-muted-foreground">{field.prompt}</p> : null}
      {IMPACT_DIMENSIONS.map((dim) => {
        const key = `${field.key}.${dim}`;
        return (
          <ChoiceCards
            key={dim}
            legend={`Wpływ — ${dim}`}
            hint={dimensionQuestion(field, dim)}
            name={key}
            options={field.options.map((o) => ({ value: o.label, label: o.label, description: o.description }))}
            value={values.picks[key]?.[0] ?? null}
            onChange={(v) => onPicks(key, [v])}
            columns={2}
          />
        );
      })}
    </div>
  );
}

function SectionEditor({
  sheetKey,
  section,
  values,
  onNotes,
  onPicks,
}: {
  sheetKey: string;
  section: CanvasSection;
  values: CanvasValues;
  onNotes: (key: string, v: string) => void;
  onPicks: (key: string, v: string[]) => void;
}) {
  const label = sentenceCase(section.label);
  const nk = notesKey(sheetKey, section.key);
  return (
    <section aria-labelledby={`canvas-${nk}`} className="border-hairline rounded-lg border p-5 md:p-6">
      <h3 id={`canvas-${nk}`} className="font-display text-2xl font-bold">
        {label}
      </h3>
      {section.prompt ? <p className="mt-2">{section.prompt}</p> : null}
      <div className="mt-5 flex flex-col gap-8">
        {section.fields.map((f) => (
          <FieldEditor key={f.key} field={f} values={values} onNotes={onNotes} onPicks={onPicks} />
        ))}
        <TextAreaField
          label={`Notatki: ${label}`}
          hint="Dopisz własnymi słowami to, czego nie ma w opcjach powyżej."
          value={values.notes[nk] ?? ""}
          onChange={(v) => onNotes(nk, v)}
          maxLength={4000}
          rows={3}
          required={false}
        />
      </div>
    </section>
  );
}

/** Static A4 rendering of the filled canvas — only in print. */
function CanvasPrint({ def, values, code, title }: { def: CanvasDef; values: CanvasValues; code: string; title: string }) {
  const credit = `Canvas: ${def.source.publisher.split(" (")[0]}, wersja ${def.source.version ?? "—"}, ${formatDatePl(def.source.versionDate) || ""}. ${def.source.basedOn}`;
  return (
    <div className="hidden print:block">
      {def.sheets.map((sheet) => (
        <section key={sheet.key} className="canvas-print-sheet">
          <p className="text-sm">
            Sprawa {code} · {title}
          </p>
          <h2 className="mb-2 text-xl font-bold">{sheet.title}</h2>
          <div className="grid grid-cols-3 gap-2">
            {sheet.sections.map((section) => {
              const lines: string[] = [];
              const note = values.notes[notesKey(sheet.key, section.key)];
              for (const f of section.fields) {
                if (f.kind === "text" && values.notes[f.key]) lines.push(`${f.label}: ${values.notes[f.key]}`);
                if ((f.kind === "single" || f.kind === "multi") && values.picks[f.key]?.length)
                  lines.push(`${f.label}: ${values.picks[f.key]!.join(", ")}`);
                if (f.kind === "matrix")
                  for (const d of IMPACT_DIMENSIONS) {
                    const p = values.picks[`${f.key}.${d}`];
                    if (p?.length) lines.push(`${d}: ${p.join(", ")}`);
                  }
              }
              if (note) lines.push(note);
              return (
                <div key={section.key} className="min-h-[55mm] rounded border border-black p-2 text-[10pt] leading-snug">
                  <h3 className="font-bold uppercase">{section.label}</h3>
                  {lines.length ? (
                    <ul className="mt-1 list-disc pl-4">
                      {lines.map((l) => (
                        <li key={l} className="whitespace-pre-wrap">
                          {l}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 italic">(nie wypełniono)</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[8pt]">{credit}</p>
        </section>
      ))}
    </div>
  );
}

/**
 * The INNO AGH Social Innovation Canvas, interactive: every section of the
 * three sheets with its own prompt, options and a notes box. Autosaved on this
 * device; „Zapisz Canvas" stores it on the case. Printing gives one A4 sheet
 * per canvas sheet.
 */
export function CanvasEditor({
  def,
  code,
  token,
  title,
  initial,
}: {
  def: CanvasDef;
  code: string;
  token?: string;
  title: string;
  initial: CanvasValues;
}) {
  const storageKey = `jd_canvas_${code}`;
  const [values, setValues] = useState<CanvasValues>(initial);
  const [status, setStatus] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const loaded = useRef(false);
  const save = api.ideas.saveCanvas.useMutation();

  useEffect(() => {
    const local = safeStorage.get<{ values: CanvasValues; at: string }>(storageKey);
    if (local?.values) {
      setValues(local.values);
      setDirty(true);
      setStatus("Przywróciliśmy niezapisane zmiany z tego urządzenia. Kliknij „Zapisz Canvas”, żeby zapisać je w sprawie.");
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (loaded.current && dirty) safeStorage.set(storageKey, { values, at: new Date().toISOString() });
  }, [values, dirty, storageKey]);

  const onNotes = (key: string, v: string) => {
    setDirty(true);
    setValues((s) => ({ ...s, notes: { ...s.notes, [key]: v } }));
  };
  const onPicks = (key: string, v: string[]) => {
    setDirty(true);
    setValues((s) => ({ ...s, picks: { ...s.picks, [key]: v } }));
  };

  async function onSave() {
    setStatus("Zapisujemy…");
    try {
      const res = await save.mutateAsync({ code, token, canvas: values });
      safeStorage.remove(storageKey);
      setDirty(false);
      setStatus(`Zapisano w sprawie ${code} o ${new Date(res.savedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (e) {
      setStatus(`Nie zapisano: ${errorText(e)} Zmiany zostały na tym urządzeniu.`);
    }
  }

  const toolbar = (
    <div className="border-hairline bg-background sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t py-4 print:hidden">
      <Button type="button" onClick={() => void onSave()} disabled={save.isPending}>
        <SaveIcon aria-hidden="true" />
        {save.isPending ? "Zapisujemy…" : "Zapisz Canvas"}
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <PrinterIcon aria-hidden="true" />
        Drukuj (3 strony A4)
      </Button>
      <p role="status" aria-live="polite" className="min-w-0 flex-1 basis-60">
        {status || (dirty ? "Masz niezapisane zmiany (są bezpieczne na tym urządzeniu)." : "")}
      </p>
    </div>
  );

  return (
    <>
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } .canvas-print-sheet { break-after: page; } .canvas-print-sheet:last-child { break-after: auto; } }`}</style>
      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-12 print:hidden">
        <nav aria-label="Arkusze Canvasu">
          <ol className="flex flex-wrap gap-3">
            {def.sheets.map((s, i) => (
              <li key={s.key}>
                <a href={`#${s.key}`} className="border-input hover:bg-surface inline-flex min-h-12 items-center rounded-md border-2 px-4 font-semibold">
                  {sheetHeading(def, i)}: {s.sections.map((x) => sentenceCase(x.label)).join(", ")}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {def.sheets.map((sheet) => (
          <section key={sheet.key} id={sheet.key} aria-labelledby={`${sheet.key}-h`} className="scroll-mt-6">
            <h2 id={`${sheet.key}-h`} className="font-display text-3xl font-bold">
              {sheet.title}
            </h2>
            <div className="mt-6 flex flex-col gap-6">
              {sheet.sections.map((section) => (
                <SectionEditor key={section.key} sheetKey={sheet.key} section={section} values={values} onNotes={onNotes} onPicks={onPicks} />
              ))}
            </div>
          </section>
        ))}
        {toolbar}
      </form>
      <CanvasPrint def={def} values={values} code={code} title={title} />
    </>
  );
}
