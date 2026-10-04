import { useTranslations } from "next-intl";

import { IMPACT_DIMENSIONS, impactLabel, type CanvasDef, type CanvasField } from "~/server/ideas/canvas-def";

/** „PROBLEM" → „Problem" (same rule as the editor). */
function sentenceCase(label: string): string {
  if (label !== label.toUpperCase()) return label;
  const lower = label.toLocaleLowerCase("pl-PL");
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}

/** An empty box to tick on paper. */
function Box() {
  return <span aria-hidden="true" className="mt-1 inline-block size-4 shrink-0 border-2 border-current print:size-3 print:border" />;
}

/** Lines to write on, on paper. */
function WriteHere({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="mt-2 flex flex-col gap-6 print:gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="border-input block border-b border-dashed print:border-black" />
      ))}
    </div>
  );
}

function BlankField({ def, field }: { def: CanvasDef; field: CanvasField }) {
  const t = useTranslations("ideas.canvas");
  const options = (
    <ul className="mt-2 flex flex-col gap-1.5 print:gap-0.5">
      {field.options.map((o) => (
        <li key={o.label} className="flex items-start gap-2">
          <Box />
          <span>
            <span className="font-semibold">{o.label}</span>
            {o.description ? <span className="text-muted-foreground print:text-black"> — {o.description}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col">
      <h4 className="font-semibold">{field.label}</h4>
      {field.prompt ? <p className="text-muted-foreground print:text-black">{field.prompt}</p> : null}
      {field.kind !== "matrix" && field.questions.length ? (
        <ul className="mt-1 list-disc pl-5">
          {field.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      ) : null}
      {field.kind === "text" ? <WriteHere /> : null}
      {field.kind === "single" || field.kind === "multi" ? options : null}
      {field.kind === "matrix"
        ? IMPACT_DIMENSIONS.map((dim) => (
            <div key={dim} className="mt-2">
              <p className="font-semibold">{t("impact", { dimension: impactLabel(def, dim) })}</p>
              {options}
            </div>
          ))
        : null}
    </div>
  );
}

/**
 * The INNO AGH canvas as blank sheets: every prompt, question and option, with
 * boxes to tick and lines to write on. Read-only, no form, no saving — for
 * anyone who wants to think an idea through on paper, with or without a case.
 * Prints as three A4 landscape pages (the page adds CANVAS_PRINT_CSS).
 */
export function CanvasBlank({ def, credit }: { def: CanvasDef; credit: string }) {
  const t = useTranslations("ideas.canvas");
  return (
    <div className="flex flex-col gap-14 print:gap-0">
      {def.sheets.map((sheet) => (
        <section key={sheet.key} aria-labelledby={`blank-${sheet.key}`} className="canvas-print-sheet">
          <h2 id={`blank-${sheet.key}`} className="font-display text-3xl font-bold print:mb-2 print:text-xl">
            {sheet.title}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 print:mt-0 print:grid-cols-3 print:gap-2 print:text-[9pt] print:leading-snug">
            {sheet.sections.map((section) => (
              <section
                key={section.key}
                aria-labelledby={`blank-${sheet.key}-${section.key}`}
                className="border-hairline border-t pt-4 print:rounded print:border print:border-black print:p-2"
              >
                <h3 id={`blank-${sheet.key}-${section.key}`} className="font-display text-xl font-bold print:text-[10pt] print:uppercase">
                  {sentenceCase(section.label)}
                </h3>
                {section.prompt ? <p className="mt-1">{section.prompt}</p> : null}
                <div className="mt-3 flex flex-col gap-5 print:gap-2">
                  {section.fields.map((f) => (
                    <BlankField key={f.key} def={def} field={f} />
                  ))}
                  <div>
                    <h4 className="font-semibold">{t("blankNotes")}</h4>
                    <WriteHere rows={2} />
                  </div>
                </div>
              </section>
            ))}
          </div>
          <p className="text-muted-foreground mt-6 text-sm print:mt-2 print:text-[7pt] print:text-black">{credit}</p>
        </section>
      ))}
    </div>
  );
}
