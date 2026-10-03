/**
 * Client-safe types and pure helpers for the INNO AGH Social Innovation Canvas
 * (data/canvas.json, transcribed from the PDF). The loader lives in ./data.ts.
 */
import type { IdeaStage, MapaArea } from "~/lib/domain";
import type { CanvasValues } from "./schema";

export type CanvasOption = { label: string; description: string | null };
export type CanvasField = {
  key: string;
  label: string;
  prompt: string | null;
  kind: "single" | "multi" | "text" | "matrix";
  options: CanvasOption[];
  questions: string[];
};
export type CanvasSection = {
  key: string;
  label: string;
  prompt: string | null;
  subfields: string[];
  fields: CanvasField[];
};
export type CanvasSheet = { key: string; title: string; page: number; sections: CanvasSection[] };
export type CanvasDef = {
  source: {
    title: string;
    url: string;
    publisher: string;
    basedOn: string;
    version: string | null;
    versionDate: string | null;
    capturedAt: string;
  };
  sheets: CanvasSheet[];
};

/** The three impact dimensions of sheet 3 (the matrix rows are the options). */
export const IMPACT_DIMENSIONS = ["Osoba", "Społeczność", "Środowisko"] as const;

/** Key of a section's free-notes box. */
export const notesKey = (sheet: string, section: string) => `${sheet}.${section}`;

/** IDEA_STAGES is the canvas „Gotowość do wdrożenia" scale, one to one. */
export const STAGE_TO_READINESS: Record<IdeaStage, string> = {
  idea: "Pomysł",
  prototype: "Prototyp",
  tested: "Przetestowane rozwiązanie",
  ready: "Gotowe do wdrożenia",
};

/** Only the areas with an unambiguous „Główny użytkownik" option on sheet 2. */
const AREA_TO_MAIN_USER: Partial<Record<MapaArea, string>> = {
  seniors: "seniorzy",
  disability: "osoby z niepełnosprawnościami",
};

/**
 * First values of the canvas from the fiszka: the idea's description goes to
 * „Rozwiązanie", the target group to „Odbiorcy", the stage to „Gotowość do
 * wdrożenia" and clear-cut areas to „Główny użytkownik". Nothing is invented.
 */
export function canvasFromIdea(idea: {
  title?: string;
  description?: string;
  targetGroup?: string;
  stage?: IdeaStage;
  areas?: MapaArea[];
}): CanvasValues {
  const notes: Record<string, string> = {};
  const picks: Record<string, string[]> = {};
  if (idea.description) notes[notesKey("sheet1", "solution")] = idea.description;
  if (idea.targetGroup) notes[notesKey("sheet2", "recipients")] = idea.targetGroup;
  if (idea.stage) picks.readiness = [STAGE_TO_READINESS[idea.stage]];
  const users = (idea.areas ?? []).map((a) => AREA_TO_MAIN_USER[a]).filter((x): x is string => !!x);
  if (users.length) picks.mainUser = [...new Set(users)];
  return { notes, picks };
}

/** Keeps only keys and option labels that exist in the canvas definition. */
export function sanitizeCanvas(def: CanvasDef, v: CanvasValues): CanvasValues {
  const noteKeys = new Set<string>();
  const options = new Map<string, Set<string>>();
  for (const sheet of def.sheets) {
    for (const section of sheet.sections) {
      noteKeys.add(notesKey(sheet.key, section.key));
      for (const f of section.fields) {
        if (f.kind === "text") noteKeys.add(f.key);
        if (f.kind === "single" || f.kind === "multi") options.set(f.key, new Set(f.options.map((o) => o.label)));
        if (f.kind === "matrix") {
          for (const d of IMPACT_DIMENSIONS) options.set(`${f.key}.${d}`, new Set(f.options.map((o) => o.label)));
        }
      }
    }
  }
  const notes: Record<string, string> = {};
  for (const [k, text] of Object.entries(v.notes)) if (noteKeys.has(k) && text.trim()) notes[k] = text.trim();
  const picks: Record<string, string[]> = {};
  for (const [k, labels] of Object.entries(v.picks)) {
    const allowed = options.get(k);
    if (!allowed) continue;
    const kept = [...new Set(labels.filter((l) => allowed.has(l)))];
    if (kept.length) picks[k] = kept;
  }
  return { notes, picks };
}

/** Plain-text rendering of the filled canvas (for the application draft). */
export function canvasToText(def: CanvasDef, v: CanvasValues): string {
  const out: string[] = [];
  for (const sheet of def.sheets) {
    for (const section of sheet.sections) {
      const lines: string[] = [];
      const note = v.notes[notesKey(sheet.key, section.key)];
      if (note) lines.push(note);
      for (const f of section.fields) {
        if (f.kind === "text" && v.notes[f.key]) lines.push(`${f.label}: ${v.notes[f.key]}`);
        if ((f.kind === "single" || f.kind === "multi") && v.picks[f.key]?.length)
          lines.push(`${f.label}: ${v.picks[f.key]!.join(", ")}`);
        if (f.kind === "matrix") {
          for (const d of IMPACT_DIMENSIONS) {
            const p = v.picks[`${f.key}.${d}`];
            if (p?.length) lines.push(`Wpływ — ${d}: ${p.join(", ")}`);
          }
        }
      }
      if (lines.length) out.push(`${section.label}\n${lines.join("\n")}`);
    }
  }
  return out.join("\n\n");
}
