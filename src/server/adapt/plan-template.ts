/**
 * The Ramowy Plan Wdrożenia, built without AI — every section filled from the
 * innovation card, the gmina's GUS figures, the institution's answers and the
 * ROPS calls, with „[DO UZUPEŁNIENIA]" where only the institution knows.
 *
 * Sections 2 (scale), 7 (budget) and 10 (funding) are ALWAYS taken from here,
 * even when the AI writes the rest: figures, money and call facts never come
 * from the model.
 */
import { formatDatePl, pluralPl } from "~/components/kit/format";
import { CALL_STATUS_LABEL, type MapaArea } from "~/lib/domain";
import {
  BUDGET_BOUNDS,
  BUDGET_LABEL,
  INSTITUTION_LABEL,
  PLAN_DISCLAIMER,
  STAFF_LABEL,
  TIMEFRAME_LABEL,
  type PlanMode,
} from "./options";
import {
  int,
  KIND_LABEL,
  pct,
  powiatDisplay,
  signedPct,
} from "./profile";
import type { CardSentence, PlanCard, PlanContext } from "./types";

export const TODO = "[DO UZUPEŁNIENIA]";
export const CHECK = "do weryfikacji";

export const SECTION_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type SectionNumber = (typeof SECTION_NUMBERS)[number];
/** Sections whose content is computed on the server in every mode. */
export const FIXED_SECTIONS: readonly SectionNumber[] = [2, 7, 10];
/** Sections the AI writes (the template stands in when it does not). */
export const AI_SECTIONS: readonly SectionNumber[] = [1, 3, 4, 5, 6, 8, 9];

export function sectionTitle(n: SectionNumber, cardTitle: string): string {
  const titles: Record<SectionNumber, string> = {
    1: "Cel usługi",
    2: "Grupa docelowa i skala",
    3: `Opis usługi na bazie innowacji „${cardTitle}”`,
    4: "Etapy wdrożenia i harmonogram",
    5: "Zespół i kompetencje",
    6: "Partnerzy",
    7: "Budżet orientacyjny",
    8: "Ryzyka i jak im zapobiec",
    9: "Wskaźniki rezultatu",
    10: "Finansowanie",
  };
  return titles[n];
}

export function sectionHeading(n: SectionNumber, cardTitle: string): string {
  return `## ${n}. ${sectionTitle(n, cardTitle)}`;
}

// ---------------------------------------------------------------------------
// Small Markdown helpers
// ---------------------------------------------------------------------------

/** Card text inside our Markdown: one line, no accidental emphasis or links. */
export function mdText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([\\*_`[\]|])/g, "\\$1");
}

/** A card sentence as we print it — always OUR text for the id. */
export function quoteSentence(s: Pick<CardSentence, "id" | "text">): string {
  return `„${mdText(s.text)}” *(karta, zdanie ${s.id})*`;
}

function quoteBlock(sentences: CardSentence[]): string {
  return sentences.map((s) => `> ${quoteSentence(s)}`).join("\n>\n");
}

function sentencesOf(
  card: PlanCard,
  section: CardSentence["section"],
  max: number,
): CardSentence[] {
  return card.sentences
    .filter((s) => s.section === section && s.text.trim().length > 0)
    .slice(0, max);
}

const MONEY = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
function roundMoney(n: number): number {
  const step = n < 10_000 ? 100 : n < 100_000 ? 500 : 1000;
  return Math.round(n / step) * step;
}
function amount(n: number): string {
  return MONEY.format(roundMoney(n));
}
export function zl(n: number): string {
  return `${amount(n)} zł`;
}

function gminaPhrase(ctx: PlanContext): string {
  const p = ctx.profile;
  return `${p.name} (${KIND_LABEL[p.kind]}, ${powiatDisplay(p.powiatName)})`;
}

function groupSizeText(n: number | null | undefined): string {
  if (!n) return TODO;
  return `${int(n)} ${pluralPl(n, "osoba", "osoby", "osób")}`;
}

// ---------------------------------------------------------------------------
// Header and footer
// ---------------------------------------------------------------------------

export function planHeader(ctx: PlanContext): string {
  const { card, inputs } = ctx;
  const lines = [
    `# Ramowy Plan Wdrożenia: „${mdText(card.title)}”`,
    "",
    `**${INSTITUTION_LABEL[inputs.institution]}** · ${gminaPhrase(ctx)}`,
    "",
    `> **${PLAN_DISCLAIMER}.**`,
    "",
  ];
  if (ctx.ramowyPlan) {
    lines.push(
      `> ROPS ma już Ramowy Plan Wdrożenia tej innowacji (nabór „Usługa Wrażliwa”)${ctx.ramowyPlan.sourceUrl ? ` — [ogłoszenie naboru](${ctx.ramowyPlan.sourceUrl})` : ""}. Porównaj ten projekt z planem ROPS.`,
      "",
    );
  }
  lines.push(
    "| Założenie | Wartość |",
    "|---|---|",
    `| Innowacja | „${mdText(card.title)}” — Biblioteka Innowacji Społecznych ROPS w Krakowie |`,
    `| Instytucja | ${INSTITUTION_LABEL[inputs.institution]} |`,
    `| Gmina | ${gminaPhrase(ctx)} |`,
    `| Zespół | ${STAFF_LABEL[inputs.staff]} |`,
    `| Budżet | ${BUDGET_LABEL[inputs.budget]} (${CHECK}) |`,
    `| Czas realizacji | ${TIMEFRAME_LABEL[inputs.timeframe]} |`,
    `| Planowana liczba odbiorców | ${inputs.groupSize ? groupSizeText(inputs.groupSize) : "nie podano"} |`,
    "",
  );
  return lines.join("\n");
}

export function planFooter(
  ctx: PlanContext,
  mode: PlanMode,
  opts: { fallbackUsed?: boolean } = {},
): string {
  const { card, gus } = ctx;
  const calls = ctx.funding.filter((c) => c.sourceUrl);
  const lines = [
    "",
    "---",
    "",
    "## Źródła",
    "",
    `- Karta innowacji „${mdText(card.title)}”: Biblioteka Innowacji Społecznych, ROPS w Krakowie — ${card.sourceUrl} (stan na ${formatDatePl(card.capturedAt)})`,
    `- Ludność gminy: ${gus.name}, ${gus.year} — ${gus.url} (pobrano ${formatDatePl(gus.capturedAt)})`,
    ...calls.map(
      (c) =>
        `- Nabór „${mdText(shortCallName(c.name))}”: ogłoszenie ROPS w Krakowie — ${c.sourceUrl}`,
    ),
    "",
    `Przygotowano ${formatDatePl(ctx.generatedAt)} w serwisie Już Działa — ${mode === "ai" ? "z pomocą Asystenta AI; liczby, budżet i nabory wstawił system z danych źródłowych" : "z szablonu, bez udziału AI"}.${opts.fallbackUsed ? " Asystent AI nie przygotował wszystkich części — brakujące sekcje uzupełniono z szablonu." : ""}`,
    "",
    `**${PLAN_DISCLAIMER}.**`,
    "",
  ];
  return lines.join("\n");
}

/**
 * „Usługa Wrażliwa – upowszechnianie… (II nabór)" out of the long official
 * call name: the quoted project name, plus the call's ordinal when it has one.
 */
export function shortCallName(name: string): string {
  const m = /[„"]([^”"]+)[”"]/.exec(name);
  const short = m?.[1]?.trim() ?? name;
  const ordinal = /^([IVX]+)\s+nabór/i.exec(name.trim())?.[1];
  return ordinal ? `${short} (${ordinal} nabór)` : short;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function section1(ctx: PlanContext): string {
  const { card, inputs, profile } = ctx;
  const problems = sentencesOf(card, "problems", 2);
  const out = [
    `Celem usługi jest uruchomienie w gminie ${profile.name} usługi opartej na innowacji „${mdText(card.title)}” z Biblioteki Innowacji Społecznych ROPS w Krakowie. Usługę prowadzi: ${INSTITUTION_LABEL[inputs.institution]}.`,
    "",
  ];
  if (problems.length) {
    out.push("Problem, na który odpowiada innowacja (z karty):", "", quoteBlock(problems), "");
  }
  if (inputs.needs) {
    out.push(
      "Potrzeby opisane przez instytucję:",
      "",
      `> ${mdText(inputs.needs)}`,
      "",
    );
  }
  out.push(
    `Cel w liczbach: ${TODO} — komu i w jakim czasie usługa ma pomóc${inputs.groupSize ? ` (instytucja planuje objąć usługą ${groupSizeText(inputs.groupSize)})` : ""}.`,
  );
  return out.join("\n");
}

/** Section 2 — computed on the server from GUS, never by the model. */
export function section2(ctx: PlanContext): string {
  const { card, profile: p, gus, inputs } = ctx;
  const target = sentencesOf(card, "targetGroup", 2);
  const out: string[] = [];
  if (target.length) {
    out.push("Grupa docelowa według karty innowacji:", "", quoteBlock(target), "");
  }
  out.push(
    `Mieszkańcy gminy ${p.name} (${KIND_LABEL[p.kind]}, ${powiatDisplay(p.powiatName)}), stan na 31 grudnia ${p.year}:`,
    "",
    "| Wskaźnik | Wartość |",
    "|---|---|",
    `| Liczba mieszkańców | ${int(p.population)} |`,
    `| Osoby w wieku 65 lat i więcej | ${int(p.pop65)} (${pct(p.share65)}% mieszkańców) |`,
    `| Osoby w wieku 80 lat i więcej | ${int(p.pop80)} (${pct(p.share80)}% mieszkańców; mediana gmin Małopolski: ${pct(p.medianShare80)}%) |`,
    p.popChange10y === null
      ? `| Zmiana liczby mieszkańców ${gus.baseYear}–${p.year} | brak porównania — gmina zmieniła granice po ${gus.baseYear} r. |`
      : `| Zmiana liczby mieszkańców ${gus.baseYear}–${p.year} | ${signedPct(p.popChange10y)}${p.popChange10y < 0 ? " — ludność maleje" : ""} |`,
    "",
    `Źródło: ${gus.name}, ${p.year} — [zapytanie do BDL dla tej gminy](${gus.url}), pobrano ${formatDatePl(gus.capturedAt)}.`,
    "",
  );
  const seniorsCard = card.mapaAreas.includes("seniors");
  if (inputs.groupSize) {
    out.push(
      `Skala usługi: instytucja planuje objąć usługą ${groupSizeText(inputs.groupSize)}.${
        seniorsCard && p.pop65 > 0
          ? ` To ${pct((inputs.groupSize / p.pop65) * 100)}% mieszkańców gminy w wieku 65+.`
          : ""
      }`,
    );
  } else {
    out.push(
      `Skala usługi: ${TODO} — ile osób usługa obejmie w pierwszym roku.`,
    );
  }
  if (!seniorsCard) {
    out.push(
      "",
      `Liczba osób z grupy docelowej w gminie: ${TODO} — tabela GUS powyżej opisuje wszystkich mieszkańców; dane o tej grupie ma zwykle ośrodek pomocy społecznej lub lokalna diagnoza.`,
    );
  }
  return out.join("\n");
}

function section3(ctx: PlanContext): string {
  const { card, profile } = ctx;
  const out: string[] = [];
  const solution = sentencesOf(card, "solution", 4);
  const who = sentencesOf(card, "whoCanUse", 2);
  const works = sentencesOf(card, "doesItWork", 2);
  if (solution.length)
    out.push("Na czym polega rozwiązanie (z karty):", "", quoteBlock(solution), "");
  if (who.length)
    out.push("Kto może skorzystać z innowacji:", "", quoteBlock(who), "");
  if (works.length)
    out.push("Czy to działa — wyniki opisane w karcie:", "", quoteBlock(works), "");
  out.push(
    `Jak dostosować usługę do warunków Twojej instytucji w gminie ${profile.name}: ${TODO} — miejsce, dni i godziny, sposób dotarcia do odbiorców, co zmienić względem opisu w karcie.`,
  );
  const materials = [
    card.folderUrl ? `[folder (PDF)](${card.folderUrl})` : null,
    card.materialsUrl ? `[materiały do pobrania](${card.materialsUrl})` : null,
    `[karta w Bibliotece](${card.sourceUrl})`,
  ].filter(Boolean);
  out.push("", `Materiały innowacji: ${materials.join(", ")}.`);
  out.push(
    "",
    `Licencja: ${card.licence ? mdText(card.licence) : `nie podano w karcie — ${TODO} (uzgodnić z autorami)`}.`,
  );
  return out.join("\n");
}

function section4(ctx: PlanContext): string {
  const { inputs, card, profile } = ctx;
  const head = ["| Miesiąc | Etap | Co trzeba zrobić |", "|---|---|---|"];
  const licence = card.licence ? ` (licencja: ${mdText(card.licence)})` : "";
  let rows: string[];
  if (inputs.timeframe === "6") {
    rows = [
      `| 1 | Przygotowanie i zespół | Kontakt z autorami innowacji i zasady korzystania z materiałów${licence}; koordynator; szkolenie zespołu (${STAFF_LABEL[inputs.staff]}). |`,
      `| 2 | Rekrutacja odbiorców | Informacja o usłudze w gminie ${profile.name}; zgłoszenia i kwalifikacja. |`,
      "| 3–5 | Realizacja | Usługa według sekcji 3; co miesiąc spotkanie zespołu i zebranie wskaźników z sekcji 9. |",
      "| 6 | Ewaluacja i podsumowanie | Ankiety, porównanie z wartościami docelowymi, decyzja o kontynuacji. |",
    ];
  } else {
    rows = [
      `| 1 | Przygotowanie | Kontakt z autorami innowacji i zasady korzystania z materiałów${licence}; wyznaczenie koordynatora; uzgodnienia z partnerami. |`,
      `| 2 | Zespół | Skompletowanie zespołu (${STAFF_LABEL[inputs.staff]}); szkolenie z metody opisanej w karcie. |`,
      `| 3 | Rekrutacja odbiorców | Informacja o usłudze w gminie ${profile.name}; zgłoszenia i kwalifikacja odbiorców. |`,
      "| 4–10 | Realizacja | Usługa według sekcji 3; co miesiąc spotkanie zespołu i zebranie wskaźników z sekcji 9. |",
      "| 11 | Ewaluacja | Ankiety odbiorców i zespołu; porównanie wyników z wartościami docelowymi. |",
      "| 12 | Podsumowanie | Raport z pilotażu; decyzja o kontynuacji i źródle finansowania. |",
    ];
    if (inputs.timeframe === "24") {
      rows.push(`| 13 i dalej | Utrwalenie | Kontynuacja usługi — ${TODO}. |`);
    }
  }
  return [
    `Harmonogram to propozycja do dopasowania. Data rozpoczęcia: ${TODO}.`,
    "",
    ...head,
    ...rows,
  ].join("\n");
}

function section5(ctx: PlanContext): string {
  const { inputs } = ctx;
  const out = [
    `Zespół, którym dysponuje instytucja: ${STAFF_LABEL[inputs.staff]} (deklaracja instytucji).`,
    "",
    "| Rola | Zadania | Kompetencje |",
    "|---|---|---|",
    "| Koordynator usługi | Harmonogram, kontakt z autorami innowacji i partnerami, sprawozdania | Organizacja pracy, znajomość lokalnych instytucji |",
    `| Osoby prowadzące usługę | Praca z odbiorcami według metody z karty | ${TODO} — kwalifikacje wymagane przez metodę |`,
    "| Wsparcie merytoryczne (autorzy innowacji) | Szkolenie zespołu, konsultacje w trakcie pilotażu | Do uzgodnienia z autorami |",
  ];
  if (inputs.staff === "1") {
    out.push(
      "",
      "Przy jednej osobie w zespole warto od początku zaplanować zastępstwo i partnera z sekcji 6.",
    );
  }
  return out.join("\n");
}

const AREA_PARTNER_ROLES: Record<MapaArea, string> = {
  seniors:
    "Kluby seniora, uniwersytet trzeciego wieku, gminna rada seniorów — jeśli działają w gminie",
  family:
    "Szkoły i przedszkola w gminie, poradnia psychologiczno-pedagogiczna",
  disability:
    "Organizacje osób z niepełnosprawnościami, warsztaty terapii zajęciowej — jeśli działają w okolicy",
  health: "Podstawowa opieka zdrowotna w gminie",
  mental_health:
    "Podstawowa opieka zdrowotna, centrum zdrowia psychicznego obejmujące gminę — jeśli jest",
  homelessness: "Placówki dla osób w kryzysie bezdomności, streetworkerzy",
  poverty: "Powiatowy urząd pracy, podmioty ekonomii społecznej",
  migrants: "Organizacje wspierające cudzoziemców, szkoły",
};

function section6(ctx: PlanContext): string {
  const { card, inputs, profile } = ctx;
  const authors = card.sections.authors?.trim();
  const rows = [
    "| Partner | Rola w usłudze |",
    "|---|---|",
    `| Autorzy innowacji: ${authors ? mdText(authors) : `${TODO} (karta nie podaje autorów)`} | Przekazanie wiedzy i materiałów, szkolenie zespołu, konsultacje — do uzgodnienia |`,
    "| Regionalny Ośrodek Polityki Społecznej w Krakowie (Małopolski Hub Innowacji Społecznych) | Wsparcie we wdrożeniu, informacja o naborach |",
  ];
  if (inputs.institution !== "ops" && inputs.institution !== "cus") {
    rows.push(
      `| Ośrodek pomocy społecznej lub centrum usług społecznych w gminie ${profile.name} | Dotarcie do odbiorców, kierowanie osób do usługi |`,
    );
  }
  if (
    inputs.institution !== "pcpr" &&
    (card.mapaAreas.includes("family") || card.mapaAreas.includes("disability"))
  ) {
    rows.push(
      `| Powiatowe centrum pomocy rodzinie (${powiatDisplay(profile.powiatName)}) lub jednostka pełniąca jego zadania | Wsparcie rodzin i osób z niepełnosprawnościami w powiecie |`,
    );
  }
  for (const a of card.mapaAreas) {
    rows.push(`| ${AREA_PARTNER_ROLES[a]} | Informacja o usłudze, wspólna rekrutacja odbiorców |`);
  }
  return [
    ...rows,
    "",
    `Nazwy lokalnych partnerów i zakres współpracy: ${TODO}.`,
  ].join("\n");
}

const BUDGET_SHARES: { label: string; min: number; max: number }[] = [
  { label: "Wynagrodzenia zespołu realizującego usługę", min: 45, max: 60 },
  {
    label: "Szkolenie zespołu, superwizja, konsultacje z autorami innowacji",
    min: 5,
    max: 10,
  },
  { label: "Materiały, sprzęt i wyposażenie potrzebne do usługi", min: 10, max: 20 },
  { label: "Dojazdy odbiorców lub zespołu", min: 3, max: 10 },
  { label: "Informacja o usłudze i rekrutacja odbiorców", min: 2, max: 5 },
  { label: "Monitoring i ewaluacja", min: 3, max: 5 },
];

/** Section 7 — ranges only, each „do weryfikacji", from the chosen range. */
export function section7(ctx: PlanContext): string {
  const { inputs, profile } = ctx;
  const b = BUDGET_BOUNDS[inputs.budget];
  const rural = profile.kind !== "miejska";
  const range = (minShare: number, maxShare: number) => {
    if (b.max === null) return `od ${zl((b.min * minShare) / 100)}`;
    if (b.min === 0) return `do ${zl((b.max * maxShare) / 100)}`;
    return `${amount((b.min * minShare) / 100)}–${zl((b.max * maxShare) / 100)}`;
  };
  const rows = BUDGET_SHARES.map((s) => {
    const shares =
      rural && s.label.startsWith("Dojazdy") ? { min: 5, max: 15 } : s;
    return `| ${s.label} | ${shares.min}–${shares.max}% | ${range(shares.min, shares.max)} | ${CHECK} |`;
  });
  const uw = ctx.funding.find(
    (c) => c.kind === "usluga-wrazliwa" && c.amountMax,
  );
  const out = [
    `Budżet wskazany przez instytucję: ${BUDGET_LABEL[inputs.budget]} (${CHECK}).`,
    "",
    "| Kategoria kosztów | Udział w budżecie | Zakres orientacyjny | Status |",
    "|---|---|---|---|",
    ...rows,
    `| Koszty pośrednie i zarządzanie | według regulaminu naboru | ${TODO} | ${CHECK} |`,
    "",
    "Podział na kategorie to robocze założenie generatora planu, a nie norma ROPS ani wycena. Żadna kwota nie jest ceną rynkową — każdą pozycję trzeba policzyć z lokalnych stawek i regulaminu naboru.",
  ];
  if (rural) {
    out.push(
      "",
      "Dla gminy wiejskiej lub miejsko-wiejskiej przyjęto wyższy udział dojazdów (5–15%).",
    );
  }
  if (uw?.amountMax && (b.max === null || b.max > uw.amountMax)) {
    out.push(
      "",
      `Grant w naborze „Usługa Wrażliwa” wynosił do ${zl(uw.amountMax)} — budżet powyżej tej kwoty wymaga dodatkowego źródła finansowania.`,
    );
  }
  return out.join("\n");
}

function section8(ctx: PlanContext): string {
  const { profile, inputs } = ctx;
  const rows = [
    "| Ryzyko | Jak mu zapobiec |",
    "|---|---|",
    "| Mało zgłoszeń odbiorców | Rekrutacja przez instytucje, które już znają odbiorców; informacja prostym językiem; zaproszenie osobiste |",
    "| Metoda z karty nie pasuje do lokalnych warunków | Krótki test na małej grupie na początku realizacji i korekta razem z autorami innowacji |",
    "| Odejście osoby z zespołu | Co najmniej dwie osoby przeszkolone w metodzie; spisane procedury |",
    "| Brak pieniędzy na kontynuację po pilotażu | Rozmowa o finansowaniu od połowy realizacji; wyniki z sekcji 9 jako argument dla gminy |",
    "| Ochrona danych odbiorców | Minimalny zakres danych, zgody, bezpieczne przechowywanie dokumentów |",
  ];
  if (profile.depopulating && profile.popChange10y !== null) {
    rows.push(
      `| Odbiorcy rozproszeni w gminie, w której ubywa mieszkańców (${signedPct(profile.popChange10y)} w 10 lat) | Usługa w miejscu zamieszkania lub zorganizowany dojazd; łączenie wizyt w jednej okolicy |`,
    );
  }
  if (profile.kind !== "miejska") {
    rows.push(
      "| Trudny dojazd do miejsca usługi | Transport dla odbiorców lub usługa mobilna; terminy dopasowane do komunikacji publicznej |",
    );
  }
  if (inputs.staff === "1") {
    rows.push(
      "| Jedna osoba w zespole | Partner z sekcji 6 i zastępstwo zaplanowane od początku |",
    );
  }
  return rows.join("\n");
}

function section9(ctx: PlanContext): string {
  const { inputs } = ctx;
  return [
    "| Wskaźnik | Wartość docelowa | Jak mierzyć |",
    "|---|---|---|",
    `| Liczba osób objętych usługą | ${inputs.groupSize ? groupSizeText(inputs.groupSize) : TODO} | Rejestr uczestników |`,
    `| Odsetek odbiorców, którzy ocenili usługę jako pomocną | ${TODO} | Krótka ankieta po zakończeniu udziału |`,
    `| Liczba osób z zespołu przeszkolonych w metodzie | ${TODO} | Lista szkoleń |`,
    `| Rezultat właściwy dla tej innowacji (zob. „Czy to działa?” w karcie) | ${TODO} | ${TODO} |`,
    "| Decyzja o kontynuacji usługi po pilotażu | Tak / nie | Decyzja instytucji lub gminy |",
  ].join("\n");
}

function callWindow(from: string | null, to: string | null): string {
  if (!from && !to) return "nie podano";
  return `${from ? formatDatePl(from) : "?"} – ${to ? formatDatePl(to) : "?"}`;
}

/** Section 10 — the calls exactly as stored in the ROPS calls table. */
export function section10(ctx: PlanContext): string {
  const asOf = formatDatePl(ctx.generatedAt);
  const out = [`Nabory ROPS, stan na ${asOf}:`, ""];
  if (ctx.funding.length === 0) {
    out.push(`Brak naborów w bazie. Źródło finansowania: ${TODO}.`);
    return out.join("\n");
  }
  for (const c of ctx.funding) {
    out.push(`### ${mdText(shortCallName(c.name))}`, "");
    if (c.program) out.push(`- Program: ${mdText(c.program)}`);
    if (c.operator) out.push(`- Operator: ${mdText(c.operator)}`);
    out.push(
      `- Kwota grantu: ${c.amountMax ? `do ${zl(c.amountMax)}` : "nie podano"}`,
      `- Termin naboru: ${callWindow(c.windowFrom, c.windowTo)}`,
      `- Status: **${CALL_STATUS_LABEL[c.status]}**`,
    );
    if (c.purpose) out.push(`- Cel naboru (z ogłoszenia): „${mdText(c.purpose)}”`);
    if (c.ownContribution)
      out.push(`- Wkład własny (z ogłoszenia): „${mdText(c.ownContribution)}”`);
    if (c.kind === "usluga-wrazliwa" && c.innovationTitles.length > 0) {
      out.push(
        c.includesInnovation
          ? `- Ta innowacja **była na liście** innowacji tego naboru — ROPS przygotował dla niej Ramowy Plan Wdrożenia.`
          : `- Tej innowacji **nie było na liście** innowacji tego naboru. Lista: ${c.innovationTitles.map((t) => `„${mdText(t)}”`).join(", ")}.`,
      );
    }
    if (c.kind === "iws") {
      out.push(
        "- Uwaga: ten rodzaj grantu służy opracowaniu i przetestowaniu innowacji, a nie wdrożeniu gotowej usługi.",
      );
    }
    if (c.sourceUrl) out.push(`- Źródło: [ogłoszenie naboru](${c.sourceUrl})`);
    out.push("");
  }
  const openUw = ctx.funding.filter(
    (c) => c.kind === "usluga-wrazliwa" && c.status === "open",
  );
  if (openUw.length > 0) {
    const c = openUw[0]!;
    out.push(
      `**Wniosek:** nabór „${mdText(shortCallName(c.name))}” jest otwarty${c.windowTo ? ` do ${formatDatePl(c.windowTo)}` : ""}${c.innovationTitles.length > 0 && !c.includesInnovation ? ", ale obejmuje tylko innowacje z listy powyżej" : ""}.`,
    );
  } else {
    out.push(
      `**Wniosek:** żaden nabór na wdrożenie usług („Usługa Wrażliwa”) nie jest teraz otwarty. Źródło finansowania pilotażu: ${TODO} (np. budżet gminy albo kolejny nabór ROPS). O nowych naborach możesz dostać powiadomienie: [Sieć i mentorzy → subskrypcja naborów](/network).`,
    );
  }
  return out.join("\n");
}

const BUILDERS: Record<SectionNumber, (ctx: PlanContext) => string> = {
  1: section1,
  2: section2,
  3: section3,
  4: section4,
  5: section5,
  6: section6,
  7: section7,
  8: section8,
  9: section9,
  10: section10,
};

/** Every section with its heading, ready to print. */
export function templateSections(
  ctx: PlanContext,
): Record<SectionNumber, string> {
  return Object.fromEntries(
    SECTION_NUMBERS.map((n) => [
      n,
      `${sectionHeading(n, ctx.card.title)}\n\n${BUILDERS[n](ctx)}\n`,
    ]),
  ) as Record<SectionNumber, string>;
}

/** The whole plan without AI. */
export function templatePlan(ctx: PlanContext): string {
  const s = templateSections(ctx);
  return [
    planHeader(ctx),
    ...SECTION_NUMBERS.map((n) => s[n]),
    planFooter(ctx, "template"),
  ].join("\n");
}
