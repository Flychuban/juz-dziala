/**
 * ROPS grant calls → data/calls.json, INNO AGH Social Innovation Canvas → data/canvas.json
 *
 *   pnpm exec tsx scripts/build-calls.ts
 *
 * Every figure below was read from the archived source page or PDF named next to it (see
 * data/manifest.json for the bytes). Where a source does not state a value, it is null and the
 * note says so. No personal names are copied (contact persons on the mentorES pages are left
 * out; the public e-mail addresses are not needed here either).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, politeFetch, writeJson } from "./lib/http";
import { Calls, Canvas, type Criterion, type FormField } from "./schemas";
import type { z } from "zod";

const GRANTS = "https://rops.krakow.pl/nabory-szkolenia-granty-dotacje-wizyty-studyjne-studia-specjalizacje-superwizje/granty-na-innowacje-spoleczne";
const IWS_CALL = `${GRANTS},nabor-aplikacji-wnioskow-na-innowacje-spoleczne-w-ramach-projektu-pn-inkubator-wlaczenia-spolecznego-20`;
const IWS_ABOUT = "https://rops.krakow.pl/realizowane-projekty-i-zadania/inkubator-wlaczenia-spolecznego-20,o-projekcie";
const IWS_FORM_PDF = "https://rops.krakow.pl/mpliki/IS/IWS_20/za._3._Formularz_aplikacyjny_wzor.pdf";
const IWS_ANNOUNCEMENT_PDF = "https://rops.krakow.pl/mpliki/IS/IWS_20/1._Zacznik_nr_1_Ogoszenie_o_naborze_IS.pdf";
const IWS_PROCEDURES_PDF = "https://rops.krakow.pl/mpliki/IS/IWS_20/za._1._PROCEDURY_REALIZACJI_PROJEKTU_GRANTOWEGO_IWS_2.0.pdf";
const IWS_SCORECARD_PDF = "https://rops.krakow.pl/mpliki/IS/IWS_20/za._5._Karta_Oceny_merytorycznej_wzor.pdf";
const UW_SUFFIX = "nabor-wnioskow-na-pilotazowe-wdrozenie-uslug-spolecznych-bazujacych-na-innowacyjnych-rozwiazaniach-w-ramach-projektu-usluga-wrazliwa-upowszechnianie-innowacji-spolecznych-w-srodowiskach-lokalnych";
const UW1_CALL = `${GRANTS},${UW_SUFFIX}`;
const UW2_CALL = `${GRANTS},ii-${UW_SUFFIX}`;
const MENTORING = "https://rops.krakow.pl/nabory-szkolenia-granty-dotacje-wizyty-studyjne-studia-specjalizacje-superwizje/mentoring";
const CANVAS_PDF = "https://rops.krakow.pl/mpliki/IS/Moj_folder/INNO_AGH_-_SOCIAL_CANVAS.pdf";

type Call = z.infer<typeof Calls>[number];

// ------------------------------------------------------------------ IWS 2.0 application form (zał. 3), fields in order

export const IWS_FORM_FIELDS: FormField[] = [
  { key: "title", label: "Tytuł innowacji", hint: "Zastanów się nad tytułem, by był on krótki i kojarzący się z przedmiotem innowacji" },
  {
    key: "applicant",
    label: "Dane pomysłodawcy",
    hint: "Na formularzu elektronicznym do wyboru z listy: osoba fizyczna, podmiot albo grupa nieformalna (do 5 partnerów i reprezentant/ka wskazany/a do kontaktów roboczych).",
  },
  {
    key: "description",
    label: "Opis innowacji",
    hint: "Na czym polega innowacja? Jaki jest jej charakter np. produkt, aplikacja, model pracy, rozwiązanie technologiczne? Jak można krótko ją określić, opisać? Jak rozwiązanie realizuje cel projektu: wsparcie procesu włączenia społecznego/przeciwdziałanie wykluczeniu społecznemu? Jak rozwiązanie wpisuje się w ideę deinstytucjonalizacji?",
  },
  {
    key: "innovativeness",
    label: "Innowacyjność rozwiązania",
    hint: "Pomóż nam lepiej zrozumieć wyjątkowość pomysłu. Czy podobne rozwiązania są stosowane w Polsce albo na świecie? W jaki sposób proponowany projekt wnosi nową wartość w rozwiązanie zdefiniowanego problemu? Czym projekt wyróżnia się na tle innych, realizowanych w tym zakresie?",
  },
  {
    key: "problemDiagnosis",
    label: "Diagnoza problemu, na który odpowiada Twoja innowacja",
    hint: "Na jaki problem odpowiada innowacja – wskaż dane statystyczne obrazujące skalę problemu? Jakie są podstawy tej diagnozy np. raporty, badania? Czy problem, który zamierzasz rozwiązań jest zgodny z tematem wskazanym w Mapie Wyzwań Społecznych – jeśli tak to jakim?",
  },
  {
    key: "recipients",
    label: "Opis odbiorców innowacji",
    hint: "Do kogo jest skierowana Twoja innowacja? Co tą grupę wyróżnia? Jakie ma potrzeby? Z jakiego powodu są to osoby wykluczone lub zagrożone wykluczeniem?",
  },
  {
    key: "change",
    label: "Zmiana jaką wprowadza innowacja",
    hint: "Jak proponowane rozwiązanie wpłynie na opisany wyżej problem? Co zmieni w życiu grupy odbiorców? Jak wpłynie na włączenie społeczne adresatów? Dzięki czemu zapobiegnie procesowi wykluczenia społecznego?",
  },
  {
    key: "futureVision",
    label: "Wizja przyszłości innowacji",
    hint: "Czy innowacja ma potencjał do bycia zastosowaną w przyszłości na dużą skalę, dla szerokiej grupy odbiorców? Czy wypracowane rozwiązanie może zostać rozszerzone na inne grupy docelowe, być stosowane w innym kontekście lub miejscu? W jaki sposób? Jakie jej cechy pozwalają na takie rozszerzenie? Opisz łatwość stosowania i wdrażalność rozwiązania",
  },
  {
    key: "actionPlan",
    label: "Plan działania i koszty",
    hint: "Opisz w kilku, kluczowych krokach co, kiedy, jakim kosztem należy zrobić, aby przygotować i przetestować innowację. Dla każdego działania: Działanie, Termin realizacji, Koszt działania. Okres przygotowawczy (nie może przekroczyć 3 miesięcy) oraz okres testowania — Faza I i Faza II testu (nie może przekroczyć 9 miesięcy).",
  },
  {
    key: "grantAmount",
    label: "Wnioskowana kwota grantu",
    hint: "Jaka jest wnioskowana, całościowa kwota grantu? Zweryfikuj ją z kosztami częściowymi przedstawionymi w planie działania",
  },
  {
    key: "team",
    label: "Zespół projektowy i jego doświadczenie",
    hint: "Kto będzie odpowiedzialny za realizację zadań w projekcie? Jakie doświadczenie w pracy z odbiorcami innowacji, planowaniu i wdrażaniu innowacji społecznych mają te osoby, instytucje, organizacje?",
  },
  {
    key: "declarations",
    label: "Oświadczenia",
    hint: "Oświadczenia dla osoby fizycznej albo dla reprezentanta podmiotu, składane pod rygorem odpowiedzialności karnej (art. 297 § 1 kodeksu karnego).",
  },
];

// ------------------------------------------------------------------ IWS 2.0 merit criteria
// description: Procedury realizacji projektu grantowego IWS 2.0, rozdz. IX pkt 3 a)
// cardDescription: Karta oceny merytorycznej (zał. 5), część A
// minToPass: Procedury rozdz. IX pkt 4 and the card: min. 5 pkt za innowacyjność, 4 pkt za pozostałe

export const IWS_CRITERIA: Criterion[] = [
  {
    key: "innovativeness",
    label: "Innowacyjność",
    description:
      "Ocena rozwiązania pod kątem potencjału by w nowy lub znacząco zmieniony względem istniejących rozwiązań sposób rozwiązać wskazane problemy społeczne. Innowacyjność rozwiązania oceniana jest na poziomie krajowym dla danej grupy docelowej. Zadaniem wnioskodawcy jest opisanie proponowanego sposobu na tle istniejących, stosunkowo najbardziej podobnych rozwiązań istniejących w kraju.",
    cardDescription:
      "Ocena rozwiązania pod kątem potencjału by w nowy lub znacząco zmieniony względem istniejących rozwiązań sposób rozwiązać wskazane problemy społeczne. Innowacyjność rozwiązania oceniana jest na poziomie krajowym dla danej grupy docelowej.",
    min: 0,
    max: 10,
    minToPass: 5,
  },
  {
    key: "adequacy",
    label: "Adekwatność do potrzeb odbiorców i użytkowników",
    description:
      "Czy cele/produkty innowacji społecznej są adekwatne do obecnej diagnozy potrzeb i problemów grupy docelowej w skali kraju? W jakim stopniu innowacja społeczna odpowiada na potrzeby grupy docelowej? W jakim stopniu innowacja społeczna ma szansę na kontrybucję do zmiany społecznej tzn. zmianę sytuacji grupy docelowej w skali kraju?",
    cardDescription:
      "Analiza celów/produktów innowacji społecznej pod kątem adekwatności do obecnej diagnozy potrzeb i problemów grupy docelowej w skali kraju. Stopień responsywności na potrzeby odbiorców i potencjał kontrybucji do zmiany społecznej tzn. zmianę sytuacji grupy docelowej w skali kraju? Czy pomysł odpowiada na wyzwanie zgodne z Mapą Wyzwań Społecznych?",
    min: 0,
    max: 10,
    minToPass: 4,
  },
  {
    key: "costEffectiveness",
    label: "Efektywność kosztowa",
    description:
      "Ocena stopnia optymalizacji, stosunku nakładów do planowanych efektów, bilansu potencjalnych efektów pozytywnych i negatywnych innowacji społecznej.",
    cardDescription:
      "Ocena stopnia optymalizacji, stosunku nakładów do planowanych efektów, bilansu potencjalnych efektów pozytywnych i negatywnych innowacji społecznej; analiza racjonalności wskazanych kosztów (czasowych, finansowych i zasobów) w stosunku do planowanych efektów.",
    min: 0,
    max: 10,
    minToPass: 4,
  },
  {
    key: "universality",
    label: "Uniwersalność",
    description:
      "Ocena możliwości zastosowania rozwiązania w różnym miejscu, łatwość stosowania, wdrażalność rozwiązania, możliwości upowszechnienia i wyskalowania.",
    cardDescription:
      "Ocena możliwości zastosowania rozwiązania w różnym miejscu, łatwość stosowania, wdrażalność rozwiązania, możliwości upowszechnienia i wyskalowania.",
    min: 0,
    max: 10,
    minToPass: 4,
  },
  {
    key: "developmentVision",
    label: "Wizja rozwoju pomysłu w przyszłości",
    description: "Ocena pomysłów na wykorzystanie innowacji w przyszłości.",
    cardDescription: "Ocena pomysłów na wykorzystanie innowacji po zakończonym etapie inkubacji i przetestowaniu.",
    min: 0,
    max: 10,
    minToPass: 4,
  },
];

/** Library card id for a slug, from data/library.json (null if the card is not there). */
function cardIdFor(slug: string): string | null {
  const lib = JSON.parse(readFileSync(join(ROOT, "data/library.json"), "utf8")) as { id: string; slug: string }[];
  return lib.find((c) => c.slug === slug)?.id ?? null;
}

function innovation(category: string, title: string, url: string) {
  const slug = url.split(",").pop()!;
  return { category, title, url, slug, cardId: cardIdFor(slug) };
}

const UW_ELIGIBILITY = [
  "podmioty mające siedzibę lub oddział na terenie Małopolski, w szczególności samorządy terytorialne i ich jednostki organizacyjne typu OPS, PCPR, CUS oraz NGO i podmioty ekonomii społecznej,",
  "podmioty posiadające min. 3-letnie doświadczenie w co najmniej jednym obszarze zbieżnym z przedmiotem rozwiązania: pracy z grupą docelową, do której kierowana jest innowacja lub udzielaniu podobnej formy wsparcia lub działalności w obszarze innowacji,",
  "podmioty, które nie są wykluczone z możliwości otrzymania wsparcia, zgodnie z Regulaminem udzielania grantów, znajdującym się w plikach do pobrania.",
];
const UW_NOTE =
  "Grant na pilotażowe wdrożenie innowacyjnej usługi społecznej w społeczności lokalnej, bazującej na jednej z innowacji wskazanych przez ROPS (Ramowe Plany Wdrożenia). Wkład własny nie jest wymagany; grant pokrywa 100% kosztów. Odbiorcy wsparcia zależnie od innowacji: rodziny z dziećmi, dzieci i młodzież, osoby wymagające wsparcia w codziennym funkcjonowaniu i ich opiekunowie, osoby z niepełnosprawnościami lub o ograniczonej mobilności, osoby mieszkające, uczące się lub pracujące w województwie małopolskim; także kadra usług społecznych. Strona nie podaje średniej wartości grantu (amountAvg = null). Pola wniosku i kryteria oceny są w PDF-ach „Wniosek o grant” i „Wzór karty oceny merytorycznej” w plikach do pobrania — nie zostały tu przepisane (formFields i criteria puste, minScore = null).";

async function main() {
  // Fetch (or reuse from the archive) every page this file is built from.
  const iws = await politeFetch(IWS_CALL);
  for (const u of [IWS_ABOUT, IWS_FORM_PDF, IWS_ANNOUNCEMENT_PDF, IWS_PROCEDURES_PDF, IWS_SCORECARD_PDF, GRANTS]) await politeFetch(u);
  const uw1 = await politeFetch(UW1_CALL);
  const uw2 = await politeFetch(UW2_CALL);
  const mentees = await politeFetch(`${MENTORING},nabor-na-mentorowanych`);
  const mentors = await politeFetch(`${MENTORING},nabor-na-mentorow`);
  const canvasPdf = await politeFetch(CANVAS_PDF);

  const iwsCall: Call = {
    id: "iws-2-0",
    name: "Nabór aplikacji (wniosków) na innowacje społeczne w ramach projektu pn. „Inkubator Włączenia Społecznego 2.0”",
    program: "Fundusze Europejskie dla Rozwoju Społecznego 2021-2027 (FERS), V Oś Priorytetowa, Działanie 5.1: Innowacje społeczne (EFS+)",
    operator: "Regionalny Ośrodek Polityki Społecznej w Krakowie, w partnerstwie z Krakowskim Centrum Innowacyjnych Technologii INNOAGH sp. z o.o.",
    amountMax: 120000,
    amountAvg: 70000,
    currency: "PLN",
    window: { from: "2024-11-13", to: "2024-12-13" },
    status: "closed",
    eligibility: [
      "osoby fizyczne mające miejsce zamieszkania (w rozumieniu Kodeksu cywilnego) na terenie Polski i pełną zdolność do czynności prawnych",
      "osoby prawne (w szczególności fundacje, stowarzyszenia, spółki kapitałowe, spółdzielnie, w tym spółdzielnie socjalne)",
      "jednostki organizacyjne, niebędące osobami prawnymi, którym ustawa przyznaje zdolność prawną (w szczególności spółki jawne, spółki komandytowe, spółki komandytowo-akcyjne)",
      "jednostki sektora finansów publicznych",
      "grupy nieformalne osób lub podmiotów wymienionych wyżej, reprezentowane przez jednego z członków grupy nieformalnej",
    ],
    formFields: IWS_FORM_FIELDS,
    criteria: IWS_CRITERIA,
    minScore: 21,
    innovations: [],
    resultsPlanned: "kwiecień/maj 2025",
    applyUrl: "https://www.webankieta.pl/ankieta/1375387/formularz-aplikacyjny-inkubator-wlaczenia-spolecznego-20.html",
    sourceUrl: IWS_CALL,
    capturedAt: iws.capturedAt,
    notes: [
      "Grant na opracowanie i przetestowanie innowacji społecznej skierowanej do osób wykluczonych lub zagrożonych wykluczeniem społecznym; nie może mieć charakteru wdrożeniowego. Zasięg ogólnopolski.",
      `Kwota maksymalna 120 000 zł (strona naboru i Ogłoszenie o naborze); średnia wartość grantu 70 000 zł według strony projektu (${IWS_ABOUT}). Wkład własny nie jest wymagany; grant pokrywa 100% kosztów.`,
      "Realizacja do 12 miesięcy: okres przygotowawczy do 3 miesięcy, dwie fazy testowania i dopracowanie łącznie do 9 miesięcy; testerów min. 4 osoby. Wnioskodawca może złożyć maksymalnie 2 aplikacje.",
      "Ocena: formalna → merytoryczna → strategiczna. Część A oceny merytorycznej (5 kryteriów, 0–10 pkt każde, maks. 50): minimum 21 pkt, w tym min. 5 pkt za innowacyjność i 4 pkt za każde pozostałe kryterium (Karta oceny merytorycznej; Procedury rozdz. IX). Część B (pitching, 3 kryteria po 0–5 pkt: koncepcja testowania, potencjał wnioskodawcy, zgodność z ideą deinstytucjonalizacji; min. 3 pkt w każdym). Do oceny strategicznej przechodzą aplikacje z min. 32,5 z 65 pkt.",
      "Planowane rozstrzygnięcie: strona naboru podaje „kwiecień/maj 2025”, Ogłoszenie o naborze — „marzec 2025”.",
    ].join(" "),
  };

  const uw2Call: Call = {
    id: "usluga-wrazliwa-2",
    name: "II nabór wniosków na pilotażowe wdrożenie usług społecznych bazujących na innowacyjnych rozwiązaniach w ramach projektu „Usługa Wrażliwa – upowszechnianie innowacji społecznych w środowiskach lokalnych”",
    program: "Fundusze Europejskie dla Małopolski 2021-2027 (FEM), Działanie 6.23 (EFS+)",
    operator: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    amountMax: 600000,
    amountAvg: null,
    currency: "PLN",
    window: { from: "2026-05-27", to: "2026-06-30" },
    status: "closed",
    eligibility: UW_ELIGIBILITY,
    formFields: [],
    criteria: [],
    minScore: null,
    innovations: [
      innovation("Kategoria I", "Przenośne modularne łazienki", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-seniorow,przenosne-modularne-lazienki"),
      innovation("Kategoria II", "koMIX życiowy", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-dzieci-mlodziezy-i-rodziny,komix-zyciowy"),
      innovation(
        "Kategoria III",
        "Organizator kompleksowej opieki w miejscu zamieszkania",
        "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-seniorow,organizator-kompleksowej-opieki-w-miejscu-zamieszkania",
      ),
      innovation("Kategoria IV", "Szlakiem ludzi bezdomnych", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-osob-w-kryzysie-bezdomnosci,szlakiem-ludzi-bezdomnych"),
      innovation("Kategoria V", "Terapeuta przestrzeni", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-seniorow,terapeuta-przestrzeni"),
    ],
    resultsPlanned: "wrzesień 2026",
    applyUrl: "https://uw-nabor2.webankieta.pl/",
    sourceUrl: UW2_CALL,
    capturedAt: uw2.capturedAt,
    notes: `${UW_NOTE} Planowane rozstrzygnięcie według listy naborów (${GRANTS}).`,
  };

  const uw1Call: Call = {
    ...uw2Call,
    id: "usluga-wrazliwa-1",
    name: "Nabór wniosków na pilotażowe wdrożenie usług społecznych bazujących na innowacyjnych rozwiązaniach w ramach projektu „Usługa Wrażliwa – upowszechnianie innowacji społecznych w środowiskach lokalnych”",
    window: { from: "2025-12-22", to: "2026-02-20" },
    innovations: [
      innovation("Kategoria I", "Bez Presji z Depresji", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-dzieci-mlodziezy-i-rodziny,bez-presji-z-depresji"),
      innovation("Kategoria II", "Strażnik (Alarm Ally)", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-osob-z-niepelnosprawnoscia-sensoryczna,straznik"),
      innovation("Kategoria III", "Himalaje Autyzmu", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-zdrowia-i-medycyny,himalaje-autyzmu"),
      innovation("Kategoria IV", "Rodzina Adopcyjna Dorasta", "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-dzieci-mlodziezy-i-rodziny,rodzina-adopcyjna-dorasta"),
      innovation(
        "Kategoria V",
        "Głuchy czytelnik w bibliotece",
        "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-osob-z-niepelnosprawnoscia-sensoryczna,gluchy-czytelnik-w-bibliotece",
      ),
    ],
    resultsPlanned: "kwiecień 2026",
    applyUrl: "https://uw-wniosek.webankieta.pl/",
    sourceUrl: UW1_CALL,
    capturedAt: uw1.capturedAt,
  };

  const demo: Call = {
    ...iwsCall,
    id: "demo-iws",
    name: "Nabór przykładowy (demo) — granty na innowacje społeczne",
    window: { from: "2026-10-03", to: "2026-10-31" },
    status: "demo",
    resultsPlanned: null,
    applyUrl: null,
    notes:
      "Nabór demonstracyjny na potrzeby prototypu. Pola formularza, kryteria oceny, minimum punktowe i kwoty skopiowano z naboru „Inkubator Włączenia Społecznego 2.0” (id iws-2-0); nie jest to nabór ogłoszony przez ROPS.",
  };

  const mentorBase = {
    program: "mentorES - biznesowe wsparcie przedsiębiorstw społecznych (FERS 2021-2027, Priorytet IV, Działanie 4.13)",
    operator: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    amountMax: null,
    amountAvg: null,
    currency: "PLN" as const,
    window: { from: null, to: null },
    status: "open" as const,
    formFields: [],
    criteria: [],
    minScore: null,
    innovations: [],
    resultsPlanned: null,
    applyUrl: null,
  };
  const MENTOR_NOTE =
    "Wolontaryjny mentoring dla małopolskich przedsiębiorstw społecznych i zakładów aktywności zawodowej, prowadzony przez pracowników firm; udział bezpłatny, to nie jest grant (kwoty = null). Rekrutacja: „nabór do połowy listopada 2026 r.”, spotkania do końca listopada 2026 r., stacjonarnie/online — strona nie podaje dokładnych dat, więc window = null. Zgłoszenie: podpisany formularz zgłoszeniowy przesłany e-mailem (szczegóły na stronie naboru i https://es.malopolska.pl/mentoring/o-programie).";

  const menteesCall: Call = {
    ...mentorBase,
    id: "mentores-mentorowani",
    name: "mentorES — nabór na Mentorowanych",
    eligibility: ["przedsiębiorstwa społeczne", "zakłady aktywności zawodowej"],
    sourceUrl: `${MENTORING},nabor-na-mentorowanych`,
    capturedAt: mentees.capturedAt,
    notes: MENTOR_NOTE,
  };
  const mentorsCall: Call = {
    ...mentorBase,
    id: "mentores-mentorzy",
    name: "mentorES — nabór na Mentorów",
    eligibility: ["przedsiębiorstwa"],
    sourceUrl: `${MENTORING},nabor-na-mentorow`,
    capturedAt: mentors.capturedAt,
    notes: MENTOR_NOTE,
  };

  const calls = Calls.parse([iwsCall, uw1Call, uw2Call, demo, menteesCall, mentorsCall]);
  writeJson("data/calls.json", calls);
  console.log(`calls.json: ${calls.length} naborów (${calls.map((c) => `${c.id}:${c.status}`).join(", ")})`);
  for (const c of calls) for (const i of c.innovations) if (!i.cardId) console.log(`  uwaga: ${c.id} — „${i.title}" nie ma karty w library.json`);

  const canvas = Canvas.parse(buildCanvas(canvasPdf.capturedAt, canvasPdf.sha256));
  writeJson("data/canvas.json", canvas);
  console.log(`canvas.json: ${canvas.sheets.length} arkusze, ${canvas.sheets.reduce((a, s) => a + s.sections.length, 0)} sekcji`);
}

// ------------------------------------------------------------------ canvas (transcribed from the 3 rendered sheets)

type CanvasT = z.infer<typeof Canvas>;
const opt = (label: string, description: string | null = null) => ({ label, description });

function buildCanvas(capturedAt: string, sha256: string): CanvasT {
  return {
    source: {
      title: "Social Innovation Canvas",
      url: CANVAS_PDF,
      publisher: "INNO AGH (Krakowskie Centrum Innowacyjnych Technologii INNOAGH sp. z o.o.)",
      basedOn: "Canvas stworzony w oparciu o Social Innovation Canvas stworzony przez The New Global School. https://theglobal.school/social-innovation-canvas/",
      version: "1.0",
      versionDate: "2026-05-05",
      capturedAt,
      sha256,
    },
    sheets: [
      {
        key: "sheet1",
        title: "#01 SOCIAL INNOVATION CANVAS",
        page: 1,
        sections: [
          {
            key: "problem",
            label: "PROBLEM",
            prompt: null,
            subfields: ["Intensywność", "Częstotliwość", "Skala problemu"],
            fields: [
              {
                key: "intensity",
                label: "Intensywność",
                prompt: "Zaznaczcie, jak bardzo źle jest bez Waszego rozwiązania:",
                kind: "single",
                options: [
                  opt("Bardzo poważny problem", "Powoduje stres, wykluczenie albo realną krzywdę."),
                  opt("Mocno przeszkadza", "Problem regularnie blokuje ważne działania."),
                  opt("Utrudnia działanie", "Trzeba szukać alternatyw, traci się czas lub energię."),
                  opt("Lekko przeszkadza", "Da się żyć, problem raczej irytuje niż blokuje."),
                ],
                questions: [],
              },
              {
                key: "frequency",
                label: "Częstotliwość",
                prompt: "Pokolorujcie, żeby zaznaczyć - jak często występuje problem na który odpowiada Wasze rozwiązanie:",
                kind: "single",
                options: [
                  opt("Bardzo często", "Codziennie albo prawie codziennie."),
                  opt("Często", "Co tydzień lub regularnie."),
                  opt("Czasami", "Kilka razy w roku lub miesiącu."),
                  opt("Rzadko", "Raz na jakiś czas - raz w roku lub rzadziej."),
                ],
                questions: [],
              },
              {
                key: "scale",
                label: "Skala problemu",
                prompt: "Zaznaczcie, ilu ludzi dotyka problem:",
                kind: "single",
                options: [
                  opt("Pojedyncze osoby", "Dotyczy kilku osób lub małej grupy."),
                  opt("Wąska grupa", "Dotyczy konkretnej społeczności, np. uczniów jednej szkoły, ludzi z jednej okolicy, załogi konkretnej instytucji."),
                  opt("Duża grupa", "Dotyczy wielu osób w mieście, regionie, branży lub większej społeczności."),
                  opt("Bardzo szeroka grupa", "Dotyczy dużej części społeczeństwa albo wielu podobnych grup w różnych miejscach."),
                ],
                questions: [],
              },
            ],
          },
          {
            key: "changeActors",
            label: "AKTORZY ZMIANY",
            prompt: null,
            subfields: ["Wspierają zmianę", "Utrudniają zmianę"],
            fields: [
              {
                key: "supporters",
                label: "Wspierają zmianę",
                prompt: "Wypiszcie osoby, grupy lub instytucje, które widzą potrzebę zmiany, wspierają Wasz pomysł albo mogą pomóc go wdrożyć.",
                kind: "text",
                options: [],
                questions: [
                  "Kto najbardziej potrzebuje tej zmiany?",
                  "Kto może zyskać na rozwiązaniu?",
                  "Kto już mówi, że problem trzeba rozwiązać?",
                  "Kto może Was poprzeć, polecić albo otworzyć drzwi?",
                  "Kto ma energię, wpływ lub zasoby, żeby pomóc?",
                ],
              },
              {
                key: "blockers",
                label: "Utrudniają zmianę",
                prompt: "Wypiszcie osoby, grupy lub instytucje, które mogą nie chcieć zmiany, bać się jej, tracić na niej albo utrudniać wdrożenie.",
                kind: "text",
                options: [],
                questions: [
                  "Kto może nie rozumieć potrzeby zmiany?",
                  "Kto może bać się dodatkowej pracy, kosztów lub ryzyka?",
                  "Kto może tracić wpływ, kontrolę albo dotychczasową rolę?",
                  "Kto może powiedzieć „to się nie uda”?",
                  "Kto może zablokować decyzję, finansowanie albo dostęp do odbiorców?",
                ],
              },
            ],
          },
          {
            key: "solution",
            label: "ROZWIĄZANIE",
            prompt: null,
            subfields: ["Przystępność i wartość rozwiązania", "Gotowość do wdrożenia", "Prostota i zrozumiałość"],
            fields: [
              {
                key: "valueForCost",
                label: "Przystępność i wartość rozwiązania",
                prompt: null,
                kind: "single",
                options: [
                  opt("Koszt jest większy niż korzyść", "Rozwiązanie pochłania dużo pieniędzy, czasu lub wysiłku, a efekt jest mało widoczny."),
                  opt("Korzyść i koszt są podobne", "Rozwiązanie może pomagać, ale nie jest jasne, czy opłaca się z niego korzystać."),
                  opt("Korzyść jest większa niż koszt", "Rozwiązanie oferuje zauważalną wartość za rozsądną cenę."),
                  opt(
                    "Bardzo duża wartość przy małym koszcie",
                    "Rozwiązanie skutecznie pomaga, a bariera wejścia jest niska (niskie koszty, oszczędność czasu, łatwość użycia).",
                  ),
                ],
                questions: [],
              },
              {
                key: "readiness",
                label: "Gotowość do wdrożenia",
                prompt: null,
                kind: "single",
                options: [
                  opt("Pomysł", "Mamy koncepcję, ale rozwiązanie nie zostało jeszcze sprawdzone z odbiorcami."),
                  opt("Prototyp", "Mamy pierwszą wersję rozwiązania, jednak wciąż wymaga ona testów i dopracowania."),
                  opt("Przetestowane rozwiązanie", "Rozwiązanie zostało sprawdzone z realnymi użytkownikami i wiemy, co trzeba poprawić"),
                  opt("Gotowe do wdrożenia", "Rozwiązanie można uruchomić w rzeczywistym miejscu, z prawdziwymi odbiorcami i znanymi zasobami."),
                ],
                questions: [],
              },
              {
                key: "clarity",
                label: "Prostota i zrozumiałość",
                prompt: "Czy osoba, która pierwszy raz widzi Wasze rozwiązanie, szybko rozumie: dla kogo jest, jak działa i co daje? Zaznacz najbardziej prawdziwą opcję:",
                kind: "single",
                options: [
                  opt("Rozwiązanie jest niejasne", "Trzeba długo tłumaczyć, o co chodzi. Ludzie często zadają podstawowe pytania."),
                  opt("Rozwiązanie jest częściowo jasne", "Ludzie rozumieją ogólny pomysł, ale jeszcze nie wiedzą dokładnie, jak z niego skorzystać."),
                  opt(
                    "Rozwiązanie jest jasne",
                    "Większość osób szybko rozumie, jaki problem rozwiązujemy, jak działa rozwiązanie i co trzeba zrobić, żeby z niego skorzystać.",
                  ),
                  opt("Ludzie potrafią wyjaśnić sami", "Osoba z grupy docelowej potrafi wyjaśnić rozwiązanie własnymi słowami po krótkim kontakcie z nim / korzystaniu."),
                ],
                questions: [],
              },
            ],
          },
          {
            key: "costStructure",
            label: "STRUKTURA KOSZTÓW",
            prompt: null,
            subfields: ["Stałe koszty", "Zmienne koszty"],
            fields: [
              {
                key: "fixedCosts",
                label: "Stałe koszty",
                prompt:
                  "Ponosicie je niezależnie od liczby użytkowników. Trzeba je opłacać nawet wtedy, gdy z rozwiązania korzysta mało osób albo nikt jeszcze nie korzysta. → Zaznaczcie / dopiszcie koszty, które ponosicie lub powinniście ponosić, żeby rozwiązanie mogło działać:",
                kind: "multi",
                options: [
                  "wynagrodzenie zespołu",
                  "czynsz / przestrzeń",
                  "utrzymanie aplikacji lub strony",
                  "abonamenty narzędzi",
                  "koordynacja projektu",
                  "księgowość / administracja",
                  "promocja podstawowa",
                  "sprzęt potrzebny na start",
                ].map((l) => opt(l)),
                questions: [],
              },
              {
                key: "variableCosts",
                label: "Zmienne koszty",
                prompt:
                  "Rosną, gdy korzysta więcej osób lub gdy realizujecie więcej działań. Co kosztuje za każdym razem, gdy pomagacie kolejnej osobie, grupie lub organizujecie kolejne działanie? → Zaznaczcie / dopiszcie zmienne koszty, które mogą się pojawić:",
                kind: "multi",
                options: ["materiały dla uczestników", "czas specjalisty na jedną osobę", "dojazdy", "catering", "wydruk materiałów", "wsparcie techniczne dla kolejnej osoby"].map(
                  (l) => opt(l),
                ),
                questions: [],
              },
            ],
          },
        ],
      },
      {
        key: "sheet2",
        title: "#02 SOCIAL INNOVATION CANVAS",
        page: 2,
        sections: [
          {
            key: "recipients",
            label: "ODBIORCY",
            prompt: null,
            subfields: ["Główny użytkownik", "Klient / płatnik", "Autorytet / instytucja / decydent"],
            fields: [
              {
                key: "mainUser",
                label: "Główny użytkownik",
                prompt: "Komu to rozwiązanie ma realnie pomóc?",
                kind: "multi",
                options: [
                  "dzieci",
                  "młodzież",
                  "rodzice",
                  "seniorzy",
                  "osoby z niepełnosprawnościami",
                  "nauczyciele",
                  "pracownicy instytucji",
                  "osoby w kryzysie",
                  "organizacje społeczne",
                  "mieszkańcy konkretnego miejsca",
                  "inna grupa",
                ].map((l) => opt(l)),
                questions: [],
              },
              {
                key: "payer",
                label: "Klient / płatnik",
                prompt: "Kto wyciąga portfel albo uruchamia budżet, żeby wasze rozwiązanie działało?",
                kind: "multi",
                options: [
                  "sam użytkownik",
                  "rodzic / opiekun",
                  "szkoła",
                  "firma",
                  "urząd miasta / gmina",
                  "fundacja / organizacja społeczna",
                  "grantodawca",
                  "sponsor",
                  "NFZ / instytucja publiczna",
                  "pracodawca",
                  "inna grupa",
                ].map((l) => opt(l)),
                questions: [],
              },
              {
                key: "decisionMaker",
                label: "Autorytet / instytucja / decydent",
                prompt: "Czyja zgoda, rekomendacja albo decyzja jest potrzebna, żeby rozwiązanie zostało użyte?",
                kind: "multi",
                options: [
                  "dyrektor szkoły",
                  "nauczyciel",
                  "lekarz",
                  "terapeuta",
                  "pracownik socjalny",
                  "urząd",
                  "lider lokalny",
                  "organizacja społeczna",
                  "rodzic",
                  "opiekun",
                  "menedżer",
                  "ekspert",
                  "instytucja finansująca",
                  "inna osoba/instytucja",
                ].map((l) => opt(l)),
                questions: [],
              },
            ],
          },
          {
            key: "revenue",
            label: "Źródła dochodów",
            prompt: null,
            subfields: ["Główny dochód $$", "Skalowanie dochodu $$$"],
            fields: [
              {
                key: "mainIncome",
                label: "Główny dochód $$",
                prompt: "Co jest podstawowym źródłem pieniędzy? Za co klienci będą najpewniej płacić w pierwszej kolejności?",
                kind: "single",
                options: [
                  opt("Nie wiemy jeszcze", "Nie mamy jasnego pomysłu, kto i za co miałby płacić."),
                  opt("Mamy pomysł", "Wiemy, co mogłoby być źródłem dochodu, ale nie sprawdziliśmy tego z potencjalnym klientem."),
                  opt("Mamy konkretną propozycję", "Wiemy, co oferujemy, komu i dlaczego ktoś miałby za to zapłacić lub zainwestować w utrzymanie rozwiązania."),
                  opt("Mamy potwierdzenie", "Ktoś już nam zapłacił, zadeklarował nam gotowość do wspierania finansowego naszego rozwiązania."),
                ],
                questions: ["Jeśli macie propozycję / pomysł na główne źródło finansowania, wypisz je poniżej:"],
              },
              {
                key: "incomeScaling",
                label: "Skalowanie dochodu $$$",
                prompt: "Jakie dodatkowe rzeczy możecie sprzedawać lub finansować w przyszłości?",
                kind: "single",
                options: [
                  opt("Brak jasnych dodatkowych źródeł", "Na razie widzimy tylko jedno źródło finansowania (to główne, powyżej) i nie wiemy, jak dochód mógłby rosnąć."),
                  opt("Są szanse na dodatkowe pieniądze", "Mamy kilka pomysłów na dodatkowe źródła dochodu, ale są jeszcze niesprawdzone."),
                  opt("Widzimy realne ścieżki rozwoju", "Wiemy, jakie dodatkowe usługi, pakiety lub wdrożenia można sprzedawać po pierwszym sukcesie."),
                  opt("Nasz model działania można powielać", "Rozwiązanie można sprzedawać lub finansować w wielu miejscach, dla wielu grup albo przez wiele kanałów."),
                ],
                questions: ["Jeśli macie propozycję / pomysł na główne źródło dodatkowego dochodu, wypiszcie je poniżej:"],
              },
            ],
          },
          {
            key: "valueProposition",
            label: "PROPOZYCJA WARTOŚCI",
            prompt: null,
            subfields: ["Emocjonalna", "Funkcjonalna"],
            fields: [
              {
                key: "emotional",
                label: "Emocjonalna: Co odbiorcy poczują dzięki rozwiązaniu?",
                prompt: "Zaznaczcie maksymalnie 2–3 najważniejsze wartości emocjonalne lub dopisz swoją własną.",
                kind: "multi",
                options: [
                  "Bezpieczeństwo",
                  "Spokój",
                  "Pewność",
                  "Zmniejszenie samotności",
                  "Większa sprawczość",
                  "Poprawa stanu zdrowia",
                  "Niezależność",
                  "Motywacja",
                  "Włączenie społeczne",
                  "Poczucie bycia widzianym",
                  "Poprawa nastroju",
                  "Większe zadowolenie z życia",
                ].map((l) => opt(l)),
                questions: [],
              },
              {
                key: "functional",
                label: "Funkcjonalna: Co rozwiązanie konkretnie poprawia?",
                prompt: "Zaznaczcie maksymalnie 2–3 najważniejsze wartości funkcjonalne lub dopisz swoją własną.",
                kind: "multi",
                options: [
                  "Obniża koszty",
                  "Oszczędza czas",
                  "Zwiększa skuteczność",
                  "Poprawia jakość",
                  "Upraszcza proces",
                  "Zwiększa dostępność",
                  "Zwiększa zasięg pomocy",
                  "Zmniejsza obciążenie",
                  "Poprawia bezpieczeństwo",
                  "Zwiększa wpływ społeczny",
                  "Ogranicza negatywny wpływ na środowisko",
                  "Pomaga w podejmowaniu lepszych decyzji",
                ].map((l) => opt(l)),
                questions: [],
              },
            ],
          },
        ],
      },
      {
        key: "sheet3",
        title: "#03 SOCIAL INNOVATION CANVAS",
        page: 3,
        sections: [
          {
            key: "channels",
            label: "Kanały",
            prompt: null,
            // The sheet labels both the first and the second block „BEZPOŚREDNIE"; kept as printed.
            subfields: ["BEZPOŚREDNIE: Jak ludzie trafiają do Was bezpośrednio?", "BEZPOŚREDNIE: Kto może pomóc Wam dotrzeć do odbiorców?", "DODATKOWE: Jakie kanały dodatkowe możecie wykorzystać?"],
            fields: [
              {
                key: "direct",
                label: "BEZPOŚREDNIE",
                prompt: "Jak ludzie trafiają do Was bezpośrednio?",
                kind: "multi",
                options: [
                  "własna strona internetowa",
                  "własny formularz zgłoszeniowy",
                  "własny sklep / system zakupu",
                  "kontakt telefoniczny lub mailowy",
                  "spotkania bezpośrednie",
                  "własne warsztaty",
                  "własne media społecznościowe",
                  "własna aplikacja",
                  "newsletter",
                  "wydarzenia organizowane samodzielnie",
                  "inne",
                ].map((l) => opt(l)),
                questions: [],
              },
              {
                key: "intermediaries",
                label: "BEZPOŚREDNIE",
                prompt: "Kto może pomóc Wam dotrzeć do odbiorców?",
                kind: "multi",
                options: [
                  "szkoła",
                  "urząd / gmina",
                  "organizacja społeczna",
                  "ekspert",
                  "lekarz / terapeuta",
                  "nauczyciel",
                  "pracownik socjalny",
                  "lider lokalny",
                  "firma",
                  "partner",
                  "ambasador",
                  "handlowiec",
                  "inna grupa",
                ].map((l) => opt(l)),
                questions: [],
              },
              {
                key: "additional",
                label: "DODATKOWE",
                prompt: "Jakie kanały dodatkowe możecie wykorzystać?",
                kind: "multi",
                options: [
                  "kampania online",
                  "webinary",
                  "platforma cyfrowa",
                  "lokalne wydarzenia",
                  "program ambasadorski",
                  "materiały edukacyjne",
                  "rekomendacje ekspertów",
                  "współpraca z instytucjami",
                  "newsletter",
                  "społeczność online",
                  "inne",
                  "inna osoba/instytucja",
                ].map((l) => opt(l)),
                questions: [],
              },
            ],
          },
          {
            key: "partners",
            label: "Konstelacja partnerów",
            prompt: "Zastanówcie się? Kto jest partnerem lub może nim zostać? Jak dokładnie pomaga, W którym obszarze wnosi wartość? Pamiętajcie: jeden partner może pomagać na kilka sposobów naraz.",
            subfields: ["Jak robić to taniej?", "Jak dotrzeć do odbiorców?", "Jak dawać lepszą wartość?", "Status partnera"],
            fields: [
              {
                key: "cheaper",
                label: "Jak robić to taniej?",
                prompt: "Wypisz poniżej: jacy partnerzy mogą obniżać koszty rozwiązania? W jaki sposób?",
                kind: "text",
                options: [],
                questions: [],
              },
              {
                key: "reach",
                label: "Jak dotrzeć do odbiorców?",
                prompt: "Wypisz poniżej: Jacy partnerzy mogą wspierać komunikację i dystrybucję rozwiązania? Jakimi kanałami?",
                kind: "text",
                options: [],
                questions: [],
              },
              {
                key: "betterValue",
                label: "Jak dawać lepszą wartość?",
                prompt: "Wypisz poniżej: Jacy partnerzy mogą wzmacniać propozycję wartości rozwiązania? W jaki sposób?",
                kind: "text",
                options: [],
                questions: [],
              },
              {
                key: "partnerStatus",
                label: "Status partnera",
                prompt: "Oznaczcie obok partnerów, jaki mają status:",
                kind: "single",
                options: [opt("Potwierdzony partner", "symbol: gwiazdka"), opt("Partner, z którym rozmawiacie", "symbol: kwadrat"), opt("Potencjalny partner", "symbol: plus")],
                questions: [],
              },
            ],
          },
          {
            key: "impact",
            label: "Wpływ",
            prompt: "Co zmienia Twoje rozwiązanie — dla osoby, społeczności i świata wokół? Zaznacz odpowiednie pola “x”.",
            subfields: ["Osoba", "Społeczność", "Środowisko"],
            fields: [
              {
                key: "impactMatrix",
                label: "Wpływ: osoba / społeczność / środowisko",
                prompt: "Zaznacz odpowiednie pola “x”.",
                kind: "matrix",
                options: [
                  opt("Mały wpływ", "Zmiana jest niewielka lub jeszcze niejasna."),
                  opt("Możliwy wpływ", "Widzimy potencjał zmiany, ale nie mamy jeszcze potwierdzenia."),
                  opt("Wyraźny wpływ", "Rozwiązanie daje konkretną, zauważalną zmianę."),
                  opt("Silny wpływ", "Zmiana jest duża, ważna i potwierdzona przez użytkowników, społeczność lub dane."),
                ],
                questions: [
                  "Osoba — Jak zmienia życie użytkownika? Co staje się łatwiejsze, bezpieczniejsze, spokojniejsze albo bardziej dostępne?",
                  "Społeczność — Jak pomaga większej grupie? Czy zwiększa dostęp, zmniejsza wykluczenie, wzmacnia współpracę albo poprawia jakość wsparcia?",
                  "Środowisko — Jak zmienia świat wokół? Czy ogranicza odpady, zużycie zasobów, transport, energię albo inne szkody dla środowiska?",
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

await main();
