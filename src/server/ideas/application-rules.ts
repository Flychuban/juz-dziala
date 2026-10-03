/**
 * Pure, client-safe rules of the application generator (unit-tested):
 *  - `templateDraft` — the draft without AI: fiszka and Canvas text copied
 *    into the fields they answer, „[DO UZUPEŁNIENIA]" everywhere else;
 *  - `draftToFields` — the streamed Markdown back into one value per field;
 *  - `unverifiedNumbers` — numbers in the draft that the author never wrote.
 */
import { MAPA_AREA_LABEL, IDEA_STAGE_LABEL, type IdeaStage, type MapaArea } from "~/lib/domain";
import { GAP, type ApplicationField } from "./schema";

export type FormFieldDef = { key: string; label: string; hint: string | null };

export type DraftSource = {
  title: string;
  description: string;
  targetGroup: string;
  areas: MapaArea[];
  stage: IdeaStage | null;
  /** Canvas notes by key (see canvas-def.ts), already plain text. */
  canvasNotes: Record<string, string>;
  canvasPicks: Record<string, string[]>;
};

export const APPLICANT_TEXT = `${GAP} — te dane wpiszesz w formularzu elektronicznym naboru.`;
export const DECLARATIONS_TEXT = "Oświadczenia składasz w formularzu elektronicznym naboru.";

function gap(what: string) {
  return `${GAP} (${what})`;
}

function fromCanvas(src: DraftSource, parts: [label: string, value: string | string[] | undefined][]): string[] {
  const out: string[] = [];
  for (const [label, value] of parts) {
    if (Array.isArray(value) ? value.length === 0 : !value?.trim()) continue;
    out.push(`${label}: ${Array.isArray(value) ? value.join(", ") : value!.trim()}`);
  }
  return out;
}

/** The value of one field in the AI-free draft. Only the author's own words are copied. */
export function templateValue(field: FormFieldDef, src: DraftSource): string {
  const n = src.canvasNotes;
  const p = src.canvasPicks;
  const withCanvas = (lines: string[], missing: string) =>
    lines.length ? [...lines.map((l) => `- ${l}`), "", gap(missing)].join("\n") : gap(missing);

  switch (field.key) {
    case "title":
      return src.title || gap("nazwa innowacji");
    case "applicant":
      return APPLICANT_TEXT;
    case "description":
      return [src.description, src.stage ? `Etap: ${IDEA_STAGE_LABEL[src.stage]}.` : ""].filter(Boolean).join("\n\n") || gap("opis innowacji");
    case "recipients": {
      const areas = src.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ");
      return [src.targetGroup, areas ? `Obszary Mapy Wyzwań Społecznych: ${areas}.` : ""].filter(Boolean).join("\n\n") || gap("odbiorcy innowacji");
    }
    case "problemDiagnosis":
      return withCanvas(
        fromCanvas(src, [
          ["Problem", n["sheet1.problem"]],
          ["Intensywność", p.intensity],
          ["Częstotliwość", p.frequency],
          ["Skala problemu", p.scale],
        ]),
        "dane statystyczne i źródła diagnozy",
      );
    case "change":
      return withCanvas(
        fromCanvas(src, [
          ["Wartość emocjonalna", p.emotional],
          ["Wartość funkcjonalna", p.functional],
          ["Wpływ na osobę", p["impactMatrix.Osoba"]],
          ["Wpływ na społeczność", p["impactMatrix.Społeczność"]],
          ["Wpływ na środowisko", p["impactMatrix.Środowisko"]],
          ["Notatki o wpływie", n["sheet3.impact"]],
        ]),
        "jak innowacja zmieni sytuację odbiorców",
      );
    case "futureVision":
      return withCanvas(
        fromCanvas(src, [
          ["Skalowanie dochodu", p.incomeScaling],
          ["Kanały dodatkowe", p.additional],
          ["Jak dotrzeć do odbiorców", n.reach],
        ]),
        "możliwość zastosowania na większą skalę i w innych miejscach",
      );
    case "actionPlan":
      return withCanvas(
        fromCanvas(src, [
          ["Gotowość do wdrożenia", p.readiness],
          ["Stałe koszty", p.fixedCosts],
          ["Zmienne koszty", p.variableCosts],
        ]),
        "działania, terminy i koszty: okres przygotowawczy do 3 miesięcy, dwie fazy testu łącznie do 9 miesięcy",
      );
    case "grantAmount":
      return gap("kwota grantu w zł — suma kosztów z planu działania");
    case "team":
      return withCanvas(
        fromCanvas(src, [["Kto wspiera zmianę", n.supporters]]),
        "kto realizuje projekt i jakie ma doświadczenie",
      );
    case "declarations":
      return DECLARATIONS_TEXT;
    default:
      return gap(field.label.toLowerCase());
  }
}

/** The whole AI-free draft as Markdown, one „## Label" per field. */
export function templateDraft(fields: readonly FormFieldDef[], src: DraftSource): string {
  return fields.map((f) => `## ${f.label}\n\n${templateValue(f, src)}`).join("\n\n");
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„”"*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Splits the Markdown draft on „## " headings and assigns each block to the
 * field whose label it names (exact, then prefix match). Fields the draft did
 * not answer get „[DO UZUPEŁNIENIA]", so nothing is silently dropped.
 */
export function draftToFields(markdown: string, fields: readonly FormFieldDef[]): ApplicationField[] {
  const blocks = new Map<string, string>();
  const parts = markdown.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = norm(nl < 0 ? part : part.slice(0, nl)).replace(/^\d+[.)]\s*/, "");
    const body = (nl < 0 ? "" : part.slice(nl + 1)).trim();
    const field =
      fields.find((f) => norm(f.label) === heading) ??
      fields.find((f) => heading.startsWith(norm(f.label)) || norm(f.label).startsWith(heading));
    if (field && !blocks.has(field.key)) blocks.set(field.key, body);
  }
  return fields.map((f) => {
    const value = blocks.get(f.key)?.trim();
    return { key: f.key, label: f.label, value: value?.length ? value : GAP };
  });
}

export function fieldsToMarkdown(fields: readonly ApplicationField[]): string {
  return fields.map((f) => `## ${f.label}\n\n${f.value.trim()}`).join("\n\n");
}

const NUMBER = /\d+(?:[  .,]\d+)*/g;
const canonical = (n: string) => n.replace(/[  ]/g, "").replace(/[.,]$/, "");

/**
 * Numbers in the draft that appear nowhere in what the author wrote (fiszka,
 * canvas) or in the call's own form text. Shown as „do weryfikacji" — the
 * prompt forbids inventing them, this checks it.
 */
export function unverifiedNumbers(draft: string, sources: readonly string[]): string[] {
  const known = new Set<string>();
  for (const s of sources) for (const m of s.match(NUMBER) ?? []) known.add(canonical(m));
  const out: string[] = [];
  for (const m of draft.match(NUMBER) ?? []) {
    const c = canonical(m);
    if (!known.has(c) && !out.includes(c)) out.push(c);
  }
  return out;
}
