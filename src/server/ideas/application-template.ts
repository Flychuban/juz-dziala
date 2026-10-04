/**
 * The application draft without AI (unit-tested): the fiszka and Canvas text
 * copied into the fields they answer, the gap marker everywhere else. Only the
 * author's own words are copied — nothing is invented. Wording comes from the
 * `ideas.template` messages in the author's language.
 */
import { createTranslator } from "next-intl";

import type { Locale } from "~/i18n/config";
import { MESSAGES } from "~/i18n/messages";
import { labelsFor, type IdeaStage, type MapaArea } from "~/lib/domain";
import type { FormFieldDef } from "./application-rules";
import { gapFor } from "./schema";

export type DraftSource = {
  title: string;
  description: string;
  targetGroup: string;
  areas: MapaArea[];
  stage: IdeaStage | null;
  /** Canvas notes by key (see canvas-def.ts), already plain text. */
  canvasNotes: Record<string, string>;
  /** Canvas picks by field key — saved values (Polish option labels). */
  canvasPicks: Record<string, string[]>;
  /** Titles of library cards similar to the idea (the duplicate check). */
  similar?: string[];
};

function copyFor(locale: Locale) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: "ideas.template" });
}

/** The two fixed texts, as the template writes them (also told to the AI). */
export function fixedTexts(locale: Locale) {
  const t = copyFor(locale);
  return { applicant: t("applicant", { gap: gapFor(locale) }), declarations: t("declarations") };
}

/**
 * The value of one field in the AI-free draft.
 * `pickLabel` shows a saved canvas value in the draft's language.
 */
export function templateValue(
  field: FormFieldDef,
  src: DraftSource,
  locale: Locale = "pl",
  pickLabel: (fieldKey: string, value: string) => string = (_k, v) => v,
): string {
  const t = copyFor(locale);
  const labels = labelsFor(locale);
  const marker = gapFor(locale);
  const n = src.canvasNotes;
  const p = src.canvasPicks;
  const gap = (what: string) => `${marker} (${what})`;
  const picks = (key: string) => (p[key] ?? []).map((v) => pickLabel(key, v));
  type Part = [label: string, value: string | string[] | undefined];
  const lines = (parts: Part[]) =>
    parts.flatMap(([label, value]) =>
      (Array.isArray(value) ? value.length === 0 : !value?.trim()) ? [] : [`${label}: ${Array.isArray(value) ? value.join(", ") : value!.trim()}`],
    );
  const withCanvas = (parts: Part[], missing: string, lead: string[] = []) => {
    const found = lines(parts);
    return [...lead.filter(Boolean), ...(found.length ? [found.map((l) => `- ${l}`).join("\n")] : []), gap(missing)].join("\n\n");
  };
  const c = (k: string) => t(`canvas.${k}` as never);
  const m = (k: string) => t(`missing.${k}` as never);
  const areas = src.areas.map((a) => labels.area[a]).join(", ");
  const areasLine = areas ? t("areas", { areas }) : "";
  const stageLine = src.stage ? t("stage", { stage: labels.ideaStage[src.stage] }) : "";

  switch (field.key) {
    // ---- IWS 2.0 (demo-iws)
    case "title":
      return src.title || gap(m("title"));
    case "applicant":
      return t("applicant", { gap: marker });
    case "description":
      return [src.description, stageLine].filter(Boolean).join("\n\n") || gap(m("description"));
    case "recipients":
      return [src.targetGroup, areasLine].filter(Boolean).join("\n\n") || gap(m("recipients"));
    case "problemDiagnosis":
      return withCanvas(
        [
          [c("problem"), n["sheet1.problem"]],
          [c("intensity"), picks("intensity")],
          [c("frequency"), picks("frequency")],
          [c("scale"), picks("scale")],
        ],
        m("problemDiagnosis"),
      );
    case "change":
      return withCanvas(
        [
          [c("emotional"), picks("emotional")],
          [c("functional"), picks("functional")],
          [c("impactPerson"), picks("impactMatrix.Osoba")],
          [c("impactCommunity"), picks("impactMatrix.Społeczność")],
          [c("impactEnvironment"), picks("impactMatrix.Środowisko")],
          [c("impactNotes"), n["sheet3.impact"]],
        ],
        m("change"),
      );
    case "futureVision":
      return withCanvas(
        [
          [c("incomeScaling"), picks("incomeScaling")],
          [c("additional"), picks("additional")],
          [c("reach"), n.reach],
        ],
        m("futureVision"),
      );
    case "actionPlan":
      return withCanvas(
        [
          [c("readiness"), picks("readiness")],
          [c("fixedCosts"), picks("fixedCosts")],
          [c("variableCosts"), picks("variableCosts")],
        ],
        m("actionPlan"),
      );
    case "grantAmount":
      return gap(m("grantAmount"));
    case "team":
      return withCanvas([[c("supporters"), n.supporters]], m("team"));
    case "declarations":
      return t("declarations");

    // ---- „Usługa Wrażliwa" demo (sections of a Ramowy Plan Wdrożenia)
    case "serviceGoal":
      return withCanvas([[c("problem"), n["sheet1.problem"]]], m("serviceGoal"), [src.description]);
    case "targetGroup":
      return withCanvas([[c("mainUser"), picks("mainUser")]], m("targetGroup"), [src.targetGroup, areasLine]);
    case "scope":
      return withCanvas(
        [
          [c("solution"), n["sheet1.solution"] !== src.description ? n["sheet1.solution"] : undefined],
          [c("functional"), picks("functional")],
          [c("direct"), picks("direct")],
        ],
        m("scope"),
      );
    case "schedule":
      return withCanvas([[c("readiness"), picks("readiness")]], m("schedule"), [stageLine]);
    case "staff":
      return withCanvas([[c("supporters"), n.supporters]], m("staff"));
    case "partners":
      return withCanvas(
        [
          [c("intermediaries"), picks("intermediaries")],
          [c("cheaper"), n.cheaper],
          [c("reach"), n.reach],
          [c("betterValue"), n.betterValue],
          [c("partnersNotes"), n["sheet3.partners"]],
        ],
        m("partners"),
      );
    case "budget":
      return withCanvas(
        [
          [c("fixedCosts"), picks("fixedCosts")],
          [c("variableCosts"), picks("variableCosts")],
        ],
        m("budget"),
      );
    case "risks":
      return withCanvas([[c("blockers"), n.blockers]], m("risks"));
    case "indicators":
      return gap(m("indicators"));
    case "innovation":
      return withCanvas([[c("similar"), src.similar ?? []]], m("innovation"));
    default:
      return gap(field.label.toLocaleLowerCase(locale === "en" ? "en-GB" : "pl-PL"));
  }
}

/** The whole AI-free draft as Markdown, one „## Label" per field. */
export function templateDraft(
  fields: readonly FormFieldDef[],
  src: DraftSource,
  locale: Locale = "pl",
  pickLabel?: (fieldKey: string, value: string) => string,
): string {
  return fields.map((f) => `## ${f.label}\n\n${templateValue(f, src, locale, pickLabel)}`).join("\n\n");
}
