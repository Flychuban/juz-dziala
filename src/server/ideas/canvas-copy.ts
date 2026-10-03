/**
 * The canvas as the site shows it. data/canvas.json is a verbatim transcription
 * of the INNO AGH PDF, which addresses a team („Zaznaczcie", „Wasze
 * rozwiązanie"); the site addresses one person („Ty"), so prompts and
 * questions are restated here in the second person singular, sheet titles are
 * given in Polish, and the one option description missing its full stop gets
 * it. Option labels that are picked and saved stay exactly as in the source —
 * only the info-only partner-status legend is adapted.
 */
import type { CanvasDef } from "./canvas-def";

export const SHEET_TITLE = (n: number) => `Arkusz ${n} · Canvas innowacji społecznej`;

/** field key → prompt in the „Ty" form. */
const FIELD_PROMPTS: Record<string, string> = {
  intensity: "Zaznacz, jak bardzo źle jest bez Twojego rozwiązania:",
  frequency: "Zaznacz, jak często występuje problem, na który odpowiada Twoje rozwiązanie:",
  scale: "Zaznacz, ilu ludzi dotyka problem:",
  supporters: "Wypisz osoby, grupy lub instytucje, które widzą potrzebę zmiany, wspierają Twój pomysł albo mogą pomóc go wdrożyć.",
  blockers: "Wypisz osoby, grupy lub instytucje, które mogą nie chcieć zmiany, bać się jej, tracić na niej albo utrudniać wdrożenie.",
  clarity: "Czy osoba, która pierwszy raz widzi Twoje rozwiązanie, szybko rozumie: dla kogo jest, jak działa i co daje? Zaznacz najbardziej prawdziwą odpowiedź:",
  fixedCosts:
    "Ponosisz je niezależnie od liczby użytkowników. Trzeba je opłacać nawet wtedy, gdy z rozwiązania korzysta mało osób albo nikt jeszcze nie korzysta. Zaznacz lub dopisz koszty, które ponosisz albo trzeba będzie ponosić, żeby rozwiązanie mogło działać:",
  variableCosts:
    "Rosną, gdy korzysta więcej osób albo gdy realizujesz więcej działań. Co kosztuje za każdym razem, gdy pomagasz kolejnej osobie lub grupie albo organizujesz kolejne działanie? Zaznacz lub dopisz zmienne koszty, które mogą się pojawić:",
  payer: "Kto wyciąga portfel albo uruchamia budżet, żeby Twoje rozwiązanie działało?",
  incomeScaling: "Jakie dodatkowe rzeczy możesz sprzedawać lub finansować w przyszłości?",
  emotional: "Zaznacz maksymalnie 2–3 najważniejsze wartości emocjonalne albo dopisz własną w notatkach.",
  functional: "Zaznacz maksymalnie 2–3 najważniejsze wartości funkcjonalne albo dopisz własną w notatkach.",
  direct: "Jak ludzie trafiają do Ciebie bezpośrednio?",
  intermediaries: "Kto może pomóc Ci dotrzeć do odbiorców?",
  additional: "Jakie kanały dodatkowe możesz wykorzystać?",
  partnerStatus: "Przy każdym partnerze dopisz, jaki ma status:",
  impactMatrix: "Dla każdego wymiaru zaznacz, jak duży jest wpływ:",
};

/** field key → questions in the „Ty" form (same order as the source). */
const FIELD_QUESTIONS: Record<string, string[]> = {
  supporters: [
    "Kto najbardziej potrzebuje tej zmiany?",
    "Kto może zyskać na rozwiązaniu?",
    "Kto już mówi, że problem trzeba rozwiązać?",
    "Kto może Cię poprzeć, polecić albo otworzyć drzwi?",
    "Kto ma energię, wpływ lub zasoby, żeby pomóc?",
  ],
  mainIncome: ["Jeśli masz propozycję lub pomysł na główne źródło finansowania, wypisz je w notatkach."],
  incomeScaling: ["Jeśli masz propozycję lub pomysł na główne źródło dodatkowego dochodu, wypisz je w notatkach."],
};

const SECTION_PROMPTS: Record<string, string> = {
  "sheet3.partners":
    "Zastanów się: kto jest partnerem lub może nim zostać? Jak dokładnie pomaga, w którym obszarze wnosi wartość? Pamiętaj: jeden partner może pomagać na kilka sposobów naraz.",
  "sheet3.impact": "Co zmienia Twoje rozwiązanie — dla osoby, społeczności i świata wokół?",
};

/** Info-only option labels (never saved as picks). */
const OPTION_LABELS: Record<string, Record<string, string>> = {
  partnerStatus: { "Partner, z którym rozmawiacie": "Partner, z którym rozmawiasz" },
};

const withStop = (s: string | null) => (s && !/[.!?:…]$/.test(s.trim()) ? `${s.trim()}.` : s);

/** A copy of the canvas worded for one reader. Unknown keys are left untouched. */
export function canvasForReader(def: CanvasDef): CanvasDef {
  return {
    source: def.source,
    sheets: def.sheets.map((sheet, i) => ({
      ...sheet,
      title: SHEET_TITLE(i + 1),
      sections: sheet.sections.map((section) => ({
        ...section,
        prompt: SECTION_PROMPTS[`${sheet.key}.${section.key}`] ?? section.prompt,
        fields: section.fields.map((f) => ({
          ...f,
          prompt: FIELD_PROMPTS[f.key] ?? f.prompt,
          questions: FIELD_QUESTIONS[f.key] ?? f.questions,
          options: f.options.map((o) => ({
            label: OPTION_LABELS[f.key]?.[o.label] ?? o.label,
            description: withStop(o.description),
          })),
        })),
      })),
    })),
  };
}
