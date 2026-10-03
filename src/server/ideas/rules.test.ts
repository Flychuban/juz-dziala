import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { APPLICANT_TEXT, DECLARATIONS_TEXT, draftToFields, gapsLine, templateDraft, templateValue, unverifiedNumbers, type DraftSource } from "./application-rules";
import { canvasForReader } from "./canvas-copy";
import { finalizeAssist } from "./assist-rules";
import { canvasFromIdea, canvasToText, sanitizeCanvas, type CanvasDef } from "./canvas-def";
import { normalizeSubscriptionContact, questionTitle } from "./network-rules";
import { contactProblem, GAP, subscriptionTopicSchema } from "./schema";
import { pickSimilar } from "./similar-rules";

const root = join(import.meta.dirname, "..", "..", "..");
const canvasDef = JSON.parse(readFileSync(join(root, "data", "canvas.json"), "utf8")) as CanvasDef;
const iws = (JSON.parse(readFileSync(join(root, "data", "calls.json"), "utf8")) as { id: string; formFields: { key: string; label: string; hint: string | null }[]; criteria: { key: string; label: string; max: number; minToPass: number | null }[]; minScore: number }[]).find((c) => c.id === "demo-iws")!;

describe("pickSimilar — „to już istnieje”", () => {
  it("lists cards sharing most of the idea's words", () => {
    const hits = [
      { id: "a", score: 900, matchedWords: 9 },
      { id: "b", score: 600, matchedWords: 3 },
    ];
    expect(pickSimilar(hits, 12).map((h) => h.id)).toEqual(["a"]);
  });
  it("accepts a lone hit that clearly leads, and nothing when the field is level", () => {
    expect(pickSimilar([{ id: "a", score: 800, matchedWords: 5 }, { id: "b", score: 400, matchedWords: 2 }], 10).map((h) => h.id)).toEqual(["a"]);
    expect(pickSimilar([{ id: "a", score: 644, matchedWords: 2 }, { id: "b", score: 458, matchedWords: 3 }], 11)).toEqual([]);
  });
  it("never matches everything for a three-word idea", () => {
    expect(pickSimilar([{ id: "a", score: 300, matchedWords: 3 }, { id: "b", score: 290, matchedWords: 3 }], 3)).toEqual([]);
  });
});

describe("finalizeAssist — nothing unchecked reaches the page", () => {
  const call = { id: iws.id, criteria: iws.criteria, minScore: iws.minScore };
  const full = iws.criteria.map((c) => ({ key: c.key, score: 6, reason: "Opis jest konkretny.", improve: "Dodaj dane." }));

  it("computes the total itself, clips scores and checks per-criterion minimums", () => {
    const r = finalizeAssist(
      {
        questions: ["a", "b", "c", "d"],
        angles: [],
        areaFit: [{ area: "seniors", why: "x" }, { area: "aliens", why: "y" }, { area: "seniors", why: "dup" }],
        selfScore: [...full.slice(1), { key: "innovativeness", score: 14.6, reason: "r", improve: "i" }],
      },
      call,
    );
    expect(r.questions).toHaveLength(3);
    expect(r.areaFit.map((a) => a.area)).toEqual(["seniors"]);
    expect(r.selfScore?.items.find((i) => i.key === "innovativeness")?.score).toBe(10);
    expect(r.selfScore?.total).toBe(10 + 6 * 4);
    expect(r.selfScore?.max).toBe(50);
    expect(r.selfScore?.minScore).toBe(21);
    expect(r.selfScore?.meetsMinimum).toBe(true);
  });
  it("fails the minimum when one criterion is under its own threshold", () => {
    const r = finalizeAssist({ questions: [], angles: [], areaFit: [], selfScore: full.map((s) => (s.key === "innovativeness" ? { ...s, score: 4 } : { ...s, score: 9 })) }, call);
    expect(r.selfScore?.total).toBe(40);
    expect(r.selfScore?.meetsMinimum).toBe(false);
  });
  it("withholds a self-assessment that skipped a criterion", () => {
    expect(finalizeAssist({ questions: [], angles: [], areaFit: [], selfScore: full.slice(0, 4) }, call).selfScore).toBeNull();
  });
});

describe("application draft", () => {
  const src: DraftSource = {
    title: "Wspólne zakupy",
    description: "Sąsiedzi robią zakupy dla seniorów.",
    targetGroup: "Seniorzy z małych wsi",
    areas: ["seniors"],
    stage: "idea",
    canvasNotes: { "sheet1.problem": "Daleko do sklepu, 12 km." },
    canvasPicks: { intensity: ["Mocno przeszkadza"] },
  };
  const fields = iws.formFields;

  it("copies only the author's words and marks every other field as a gap", () => {
    expect(templateValue(fields.find((f) => f.key === "title")!, src)).toBe("Wspólne zakupy");
    expect(templateValue(fields.find((f) => f.key === "applicant")!, src)).toBe(APPLICANT_TEXT);
    expect(templateValue(fields.find((f) => f.key === "declarations")!, src)).toBe(DECLARATIONS_TEXT);
    expect(templateValue(fields.find((f) => f.key === "grantAmount")!, src)).toContain(GAP);
    expect(templateValue(fields.find((f) => f.key === "problemDiagnosis")!, src)).toContain("Daleko do sklepu, 12 km.");
  });

  it("round-trips the Markdown draft into one value per field", () => {
    const parsed = draftToFields(templateDraft(fields, src), fields);
    expect(parsed.map((f) => f.key)).toEqual(fields.map((f) => f.key));
    expect(parsed[0]?.value).toBe("Wspólne zakupy");
  });

  it("maps headings that differ in case or numbering and fills missing fields with a gap", () => {
    const md = "## 1. TYTUŁ INNOWACJI\n\nZakupy\n\n## Opis innowacji\n\nTekst opisu.";
    const parsed = draftToFields(md, fields);
    expect(parsed.find((f) => f.key === "title")?.value).toBe("Zakupy");
    expect(parsed.find((f) => f.key === "description")?.value).toBe("Tekst opisu.");
    expect(parsed.find((f) => f.key === "team")?.value).toBe(GAP);
  });

  it("flags numbers the author never wrote", () => {
    const draft = "Dojazd 12 km. Koszt 45 000 zł dla 30 osób w 2026 r. Okres 3 miesięcy.";
    expect(unverifiedNumbers(draft, ["Daleko do sklepu, 12 km.", "Okres przygotowawczy (nie może przekroczyć 3 miesięcy)"])).toEqual(["45000", "30", "2026"]);
  });
});

describe("canvas", () => {
  it("prefills the stage, the clear-cut main users and the texts from the fiszka", () => {
    const v = canvasFromIdea({ description: "Opis", targetGroup: "Seniorzy", stage: "prototype", areas: ["seniors", "poverty"] });
    expect(v.picks.readiness).toEqual(["Prototyp"]);
    expect(v.picks.mainUser).toEqual(["seniorzy"]);
    expect(v.notes["sheet1.solution"]).toBe("Opis");
    // every prefilled key and option exists in the transcribed canvas
    expect(sanitizeCanvas(canvasDef, v)).toEqual(v);
  });
  it("drops unknown keys, unknown options and empty notes", () => {
    const clean = sanitizeCanvas(canvasDef, {
      notes: { "sheet1.problem": " ważne ", bogus: "x", supporters: "" },
      picks: { intensity: ["Bardzo poważny problem", "Wymyślona opcja"], "impactMatrix.Osoba": ["Silny wpływ"], nope: ["x"] },
    });
    expect(clean).toEqual({ notes: { "sheet1.problem": "ważne" }, picks: { intensity: ["Bardzo poważny problem"], "impactMatrix.Osoba": ["Silny wpływ"] } });
    expect(canvasToText(canvasDef, clean)).toContain("Wpływ — Osoba: Silny wpływ");
  });
});

describe("contacts and topics", () => {
  it("validates contacts with Polish messages", () => {
    expect(contactProblem("email", "zly")).toMatch(/e-mail/);
    expect(contactProblem("sms", "600 100 200")).toBeNull();
    expect(contactProblem("none", undefined)).toBeNull();
  });
  it("normalizes subscription contacts", () => {
    expect(normalizeSubscriptionContact("email", " Jan@Example.ORG ")).toBe("jan@example.org");
    expect(normalizeSubscriptionContact("sms", "+48 600-100-200")).toBe("+48600100200");
    expect(normalizeSubscriptionContact("sms", "123")).toBeNull();
  });
  it("accepts only known subscription topics", () => {
    expect(subscriptionTopicSchema.safeParse("calls").success).toBe(true);
    expect(subscriptionTopicSchema.safeParse("area:seniors").success).toBe(true);
    expect(subscriptionTopicSchema.safeParse("area:aliens").success).toBe(false);
  });
  it("titles a question by its first sentence", () => {
    expect(questionTitle("Jak to zrobić? Bo nie wiem.")).toBe("Jak to zrobić?");
    expect(questionTitle("a".repeat(200)).length).toBeLessThanOrEqual(90);
  });
});

describe("canvas worded for one reader („Ty”)", () => {
  const reader = canvasForReader(canvasDef);
  const texts = reader.sheets.flatMap((sh) =>
    sh.sections.flatMap((se) => [se.prompt ?? "", ...se.fields.flatMap((f) => [f.prompt ?? "", ...f.questions, ...f.options.map((o) => `${o.label} ${o.description ?? ""}`)])]),
  );
  it("has no plural address left", () => {
    const plural = /(Zaznaczcie|Pokolorujcie|Wypiszcie|Zastanówcie|Pamiętajcie|Oznaczcie|Wasz|wasz|\bWas\b|\bWam\b|możecie|macie|ponosicie|realizujecie|pomagacie|organizujecie|rozmawiacie|powinniście)/;
    expect(texts.filter((t) => plural.test(t))).toEqual([]);
  });
  it("titles the sheets in Polish and ends every option description with a full stop", () => {
    expect(reader.sheets.map((s) => s.title)).toEqual([
      "Arkusz 1 · Canvas innowacji społecznej",
      "Arkusz 2 · Canvas innowacji społecznej",
      "Arkusz 3 · Canvas innowacji społecznej",
    ]);
    const readiness = reader.sheets[0]!.sections.flatMap((s) => s.fields).find((f) => f.key === "readiness")!;
    expect(readiness.options.find((o) => o.label === "Przetestowane rozwiązanie")?.description).toMatch(/poprawić\.$/);
  });
  it("keeps every pickable option label, so saved canvases stay valid", () => {
    const v = { notes: {}, picks: { intensity: ["Bardzo poważny problem"], readiness: ["Prototyp"], mainUser: ["seniorzy"] } };
    expect(sanitizeCanvas(reader, v)).toEqual(v);
  });
});

describe("gapsLine", () => {
  it("uses the right Polish form", () => {
    expect(gapsLine(1)).toBe("Szkic gotowy. Luki „[DO UZUPEŁNIENIA]” zostały w 1 polu — uzupełnij je przed wysłaniem.");
    expect(gapsLine(3)).toContain("w 3 polach");
    expect(gapsLine(12)).toContain("w 12 polach");
    expect(gapsLine(0)).toMatch(/Wszystkie pola są wypełnione/);
  });
});
