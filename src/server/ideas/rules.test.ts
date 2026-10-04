import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createTranslator } from "next-intl";

import { MESSAGES } from "~/i18n/messages";
import { countGaps, draftToFields, DRAFT_FAILED_MARKER, splitFailure, unverifiedNumbers } from "./application-rules";
import { fixedTexts, templateDraft, templateValue, type DraftSource } from "./application-template";
import { canvasForEnglishReader, canvasForReader } from "./canvas-copy";
import { markFailure } from "./draft-stream";
import { finalizeAssist } from "./assist-rules";
import { canvasFromIdea, canvasToText, impactLabel, optionValue, pickLabel, sanitizeCanvas, type CanvasDef } from "./canvas-def";
import { normalizeSubscriptionContact, questionTitle } from "./network-rules";
import { contactProblem, contactProblemKey, GAP, GAP_EN, subscriptionTopicSchema } from "./schema";
import { finalizeSketch, SKETCH_H, SKETCH_MAX_SHAPES, SKETCH_W } from "./sketch-rules";
import { pickSimilar } from "./similar-rules";

const root = join(import.meta.dirname, "..", "..", "..");
const canvasDef = JSON.parse(readFileSync(join(root, "data", "canvas.json"), "utf8")) as CanvasDef;
type CallJson = { id: string; status: string; amountMax: number | null; window: { from: string | null; to: string | null }; formFields: { key: string; label: string; hint: string | null }[]; criteria: { key: string; label: string; max: number; minToPass: number | null }[]; minScore: number };
const calls = JSON.parse(readFileSync(join(root, "data", "calls.json"), "utf8")) as CallJson[];
const callsEn = JSON.parse(readFileSync(join(root, "data", "calls.en.json"), "utf8")) as CallJson[];
const iws = calls.find((c) => c.id === "demo-iws")!;
const uw = calls.find((c) => c.id === "demo-usluga-wrazliwa")!;
const canvasEnDef = JSON.parse(readFileSync(join(root, "data", "canvas.en.json"), "utf8")) as CanvasDef;

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
    expect(templateValue(fields.find((f) => f.key === "applicant")!, src)).toBe(`${GAP} — te dane wpiszesz w formularzu elektronicznym naboru.`);
    expect(templateValue(fields.find((f) => f.key === "declarations")!, src)).toBe(fixedTexts("pl").declarations);
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

describe("plurals in the generator and the forms", () => {
  const pl = createTranslator({ locale: "pl", messages: MESSAGES.pl, namespace: "ideas" });
  const en = createTranslator({ locale: "en", messages: MESSAGES.en, namespace: "ideas" });
  it("names the gaps with the right Polish form (locative: 1 polu, N polach)", () => {
    expect(pl("application.edit.gaps", { count: 1, gap: GAP })).toBe("Szkic gotowy. Luki „[DO UZUPEŁNIENIA]” zostały w 1 polu — uzupełnij je przed wysłaniem.");
    expect(pl("application.edit.gaps", { count: 3, gap: GAP })).toContain("w 3 polach");
    expect(pl("application.edit.gaps", { count: 12, gap: GAP })).toContain("w 12 polach");
    expect(en("application.edit.gaps", { count: 1, gap: GAP_EN })).toContain("in 1 field ");
  });
  it("never says „Zostało 3 pól” or „Zostało 2 znaków”", () => {
    expect(pl("application.sent.gaps", { count: 3 })).toMatch(/^Zostały 3 pola do uzupełnienia/);
    expect(pl("application.sent.gaps", { count: 5 })).toMatch(/^Zostało 5 pól/);
    expect(pl("application.sent.gaps", { count: 1 })).toMatch(/^Zostało 1 pole/);
    expect(pl("form.charsLeft", { count: 2 })).toBe("Zostały 2 znaki.");
    expect(pl("form.charsLeft", { count: 1 })).toBe("Został 1 znak.");
    expect(pl("form.charsLeft", { count: 12 })).toBe("Zostało 12 znaków.");
    expect(pl("form.charsLeft", { count: 22 })).toBe("Zostały 22 znaki.");
  });
  it("summarises the duplicate check in one short line", () => {
    expect(pl("similar.found", { count: 3 })).toBe("Znaleźliśmy 3 podobne rozwiązania.");
    expect(pl("similar.found", { count: 5 })).toBe("Znaleźliśmy 5 podobnych rozwiązań.");
    expect(en("similar.found", { count: 0 })).toBe("We found no similar solution in the library.");
  });
});

describe("the application follows the chosen call", () => {
  const src: DraftSource = {
    title: "Wspólne zakupy",
    description: "Sąsiedzi robią zakupy dla seniorów.",
    targetGroup: "Seniorzy z małych wsi",
    areas: ["seniors"],
    stage: "idea",
    canvasNotes: { blockers: "Sklep we wsi." },
    canvasPicks: { fixedCosts: ["czynsz / przestrzeń"], mainUser: ["seniorzy"] },
    similar: ["Mobilne centrum pomocy dla osób starszych"],
  };
  it("adds a second demo call with the sections of a Ramowy Plan Wdrożenia and its own criteria", () => {
    expect(uw.status).toBe("demo");
    expect(uw.window).toEqual({ from: null, to: null });
    expect(uw.formFields.map((f) => f.key)).toEqual([
      "serviceGoal", "targetGroup", "scope", "schedule", "staff", "partners", "budget", "risks", "indicators", "innovation",
    ]);
    expect(uw.criteria.map((c) => c.key)).not.toEqual(iws.criteria.map((c) => c.key));
    // The cap is the one already published for Usługa Wrażliwa, not a new figure.
    expect(uw.amountMax).toBe(calls.find((c) => c.id === "usluga-wrazliwa-2")!.amountMax);
  });
  it("has an English twin with the same keys", () => {
    const twin = callsEn.find((c) => c.id === uw.id)!;
    expect(twin.formFields.map((f) => f.key)).toEqual(uw.formFields.map((f) => f.key));
    expect(twin.criteria.map((c) => c.key)).toEqual(uw.criteria.map((c) => c.key));
  });
  it("fills that call's fields from the author's own words only", () => {
    const md = templateDraft(uw.formFields, src);
    const parsed = draftToFields(md, uw.formFields);
    expect(parsed.map((f) => f.key)).toEqual(uw.formFields.map((f) => f.key));
    expect(parsed.find((f) => f.key === "serviceGoal")?.value).toContain("Sąsiedzi robią zakupy dla seniorów.");
    expect(parsed.find((f) => f.key === "budget")?.value).toContain("czynsz / przestrzeń");
    expect(parsed.find((f) => f.key === "risks")?.value).toContain("Sklep we wsi.");
    expect(parsed.find((f) => f.key === "innovation")?.value).toContain("Mobilne centrum pomocy");
    expect(parsed.find((f) => f.key === "indicators")?.value).toContain(GAP);
    expect(countGaps(parsed)).toBe(uw.formFields.length);
  });
  it("writes the English template with the English gap marker and English option labels", () => {
    const view = canvasForEnglishReader(canvasForReader(canvasDef), canvasEnDef);
    const label = (k: string, v: string) => pickLabel(view, k, v);
    const field = { key: "budget", label: "Budget (an estimate to be checked)", hint: null };
    const value = templateValue(field, src, "en", label);
    expect(value).toContain(GAP_EN);
    expect(value).toContain("rent / space");
    expect(value).not.toContain(GAP);
    expect(countGaps([{ key: "budget", label: "Budget", value }])).toBe(1);
  });
});

async function pipe(chunks: string[], lines: string[]) {
  const enc = new TextEncoder();
  const src = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(markFailure(src, lines)).text();
}

describe("a broken-off AI draft is never filled in", () => {
  const lines = ["_Wystąpił błąd generowania. Spróbuj ponownie._", "_The AI assistant is temporarily unavailable._"];
  it("replaces a trailing failure line with the marker, even when it arrives in pieces", async () => {
    const out = await pipe(["## Cel usługi\n\nTekst", "\n\n_Wystąpił błąd gen", "erowania. Spróbuj ponownie._"], lines);
    expect(splitFailure(out)).toEqual({ text: "## Cel usługi\n\nTekst", failed: true });
    expect(out).not.toContain(lines[0]);
  });
  it("turns an „unavailable” answer into a failure, and leaves a good draft untouched", async () => {
    expect(splitFailure(await pipe([lines[1]!], lines)).failed).toBe(true);
    const good = "## Aim\n\n" + "x".repeat(500);
    expect(await pipe([good.slice(0, 100), good.slice(100)], lines)).toBe(good);
  });
  it("detects the failure marker and drops it", () => {
    expect(splitFailure(`## Cel usługi\n\nTekst\n\n${DRAFT_FAILED_MARKER}`)).toEqual({ text: "## Cel usługi\n\nTekst", failed: true });
    expect(splitFailure("## Cel usługi\n\nTekst")).toEqual({ text: "## Cel usługi\n\nTekst", failed: false });
  });
});

describe("canvas in English", () => {
  const view = canvasForEnglishReader(canvasForReader(canvasDef), canvasEnDef);
  it("shows English labels but keeps the Polish values, so saved canvases stay valid", () => {
    const intensity = view.sheets[0]!.sections[0]!.fields.find((f) => f.key === "intensity")!;
    expect(intensity.options[0]!.label).toBe("A very serious problem");
    expect(optionValue(intensity.options[0]!)).toBe("Bardzo poważny problem");
    const picked = { notes: {}, picks: { intensity: [optionValue(intensity.options[0]!)] } };
    expect(sanitizeCanvas(canvasForReader(canvasDef), picked)).toEqual(picked);
    expect(impactLabel(view, "Społeczność")).toBe("Community");
  });
  it("translates the option labels the English file left in Polish", () => {
    const labels = view.sheets.flatMap((s) => s.sections.flatMap((x) => x.fields.flatMap((f) => f.options.map((o) => o.label))));
    expect(labels.filter((l) => /[ąćęłńóśźż]/i.test(l) || ["dzieci", "lekarz", "webinary", "inne"].includes(l))).toEqual([]);
  });
});

describe("the sketch is data, checked before drawing", () => {
  const base = { w: null, h: null, r: null, x2: null, y2: null, fill: null, label: null };
  it("clamps every number to the canvas, keeps the palette and drops unknown kinds", () => {
    const s = finalizeSketch({
      title: "Przenośna łazienka",
      altText: "Szkic przedstawia łazienkę.",
      shapes: [
        { ...base, kind: "rect", x: -50, y: 20, w: 9000, h: 100, fill: "purple", label: "Łazienka" },
        { ...base, kind: "circle", x: 200, y: 150, r: 999, fill: "BLUE" },
        { ...base, kind: "arrow", x: 10, y: 10, x2: 1e9, y2: 20 },
        { ...base, kind: "script", x: 1, y: 1, label: "<script>" },
        { ...base, kind: "text", x: 100, y: 100, label: "<b>Hej</b>" },
        { ...base, kind: "line", x: Number.NaN, y: 1, x2: 2, y2: 2 },
      ],
    })!;
    expect(s.shapes.map((x) => x.kind)).toEqual(["rect", "circle", "arrow", "text"]);
    const [rect, circle, arrow, text] = s.shapes;
    expect(rect).toMatchObject({ x: 0, w: SKETCH_W, fill: "white" });
    expect(circle).toMatchObject({ fill: "blue", r: 150 });
    expect(arrow).toMatchObject({ x2: SKETCH_W });
    expect(text?.kind === "text" && text.label).toBe("b Hej /b");
    for (const sh of s.shapes) {
      expect(sh.x).toBeGreaterThanOrEqual(0);
      expect(sh.y).toBeLessThanOrEqual(SKETCH_H);
    }
  });
  it("draws at most the shape limit and refuses an empty or unlabelled scene", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...base, kind: "circle", x: 50 + i, y: 50, r: 10 }));
    expect(finalizeSketch({ title: "T", altText: "A", shapes: many })!.shapes).toHaveLength(SKETCH_MAX_SHAPES);
    expect(finalizeSketch({ title: "T", altText: "A", shapes: [] })).toBeNull();
    expect(finalizeSketch({ title: "", altText: "A", shapes: many })).toBeNull();
  });
});

describe("contacts in both languages", () => {
  it("returns a key the screens translate", () => {
    expect(contactProblemKey("email", "zly")).toBe("email");
    expect(contactProblemKey("phone", "12")).toBe("phone");
    expect(contactProblemKey("sms", "600 100 200")).toBeNull();
  });
});
