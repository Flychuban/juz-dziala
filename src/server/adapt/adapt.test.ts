import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { SECTION_LABEL, SECTION_LABEL_EN } from "~/lib/domain";
import { AI_STREAM_LINES } from "~/server/ai/structured";
import type { LibraryCard } from "~/server/domain/types";
import { canSeeNeeds, kAnonymize } from "./needs-count";
import {
  optionLabels,
  planInputSchema,
  planSourceMarker,
  readPlanSource,
  type PlanSource,
} from "./options";
import { createPlanAssembler } from "./plan-stream";
import {
  FIXED_SECTIONS,
  planFooter,
  planHeader,
  planSentences,
  section10,
  section7,
  templatePlan,
  templateSections,
  TODO,
  TODO_EN,
  todoMarker,
} from "./plan-template";
import {
  buildProfile,
  featuredRuralGmina,
  gminaLabel,
  median,
  matchTheme,
  medianShare80,
  powiatDisplay,
  powiatLocative,
  profileSignals,
  recommend,
  share,
  signedPct,
  type ProfileCard,
} from "./profile";
import { readStoredPlan } from "./stored-plan";
import type { FundingCall, Gmina, PlanCard, PlanCardEn, PlanContext } from "./types";

// AI_STREAM_LINES lives next to the Claude client; the client itself is never
// touched here, so its server-only imports are stubbed.
vi.mock("server-only", () => ({}));
vi.mock("~/env", () => ({ env: {} }));
vi.mock("~/server/db", () => ({ db: {} }));

const gminas = JSON.parse(readFileSync("data/gminas.json", "utf8")) as Gmina[];
const library = JSON.parse(
  readFileSync("data/library.json", "utf8"),
) as LibraryCard[];
const libraryEn = JSON.parse(
  readFileSync("data/library.en.json", "utf8"),
) as Record<string, PlanCardEn>;

/** Every line aiStream writes when it fails, in both languages. */
const FAILURE_LINES = Object.values(AI_STREAM_LINES).flatMap((l) =>
  Object.values(l),
);

/** Intl pl-PL groups digits with a no-break space. */
const nb = (s: string) => s.replace(/ /g, " ");
const byTeryt = (t: string) => gminas.find((g) => g.teryt === t)!;
const toProfileCard = (c: LibraryCard): ProfileCard => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  mapaAreas: c.mapaAreas,
  keywords: c.keywords,
  solution: c.sections.solution,
  problems: c.sections.problems,
  badge: c.badge,
});
const toPlanCard = (c: LibraryCard): PlanCard => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  sections: c.sections,
  sentences: c.sentences,
  mapaAreas: c.mapaAreas,
  categoryLabels: c.categoryLabels,
  sourceUrl: c.sourceUrl,
  capturedAt: c.capturedAt,
  licence: c.licence,
  folderUrl: c.folderUrl,
  materialsUrl: c.materialsUrl,
  orgNames: [],
  en: libraryEn[c.id]
    ? {
        title: libraryEn[c.id]!.title,
        sections: libraryEn[c.id]!.sections,
        sentences: libraryEn[c.id]!.sentences,
      }
    : null,
});

const UW: FundingCall = {
  id: "usluga-wrazliwa-2",
  kind: "usluga-wrazliwa",
  name: "II nabór wniosków … „Usługa Wrażliwa – upowszechnianie innowacji społecznych w środowiskach lokalnych”",
  program: "FEM 2021-2027, Działanie 6.23",
  operator: "ROPS w Krakowie",
  amountMax: 600000,
  windowFrom: "2026-05-27",
  windowTo: "2026-06-30",
  status: "closed",
  sourceUrl: "https://rops.krakow.pl/nabor-uw-2",
  purpose: "Grant na pilotażowe wdrożenie innowacyjnej usługi społecznej.",
  ownContribution: "Wkład własny nie jest wymagany; grant pokrywa 100% kosztów.",
  innovationTitles: ["Organizator kompleksowej opieki w miejscu zamieszkania"],
  includesInnovation: true,
  en: {
    program: "European Funds for Małopolska 2021-2027, Measure 6.23",
    operator: "ROPS Kraków",
    purpose: "A grant for a pilot implementation of an innovative social service.",
    ownContribution: "No own contribution is required; the grant covers 100% of the costs.",
    innovationTitles: ["Home-based comprehensive care organiser"],
  },
};

function ctxFor(
  cardId: string,
  teryt: string,
  over: Partial<PlanContext["inputs"]> = {},
  locale: PlanContext["locale"] = "pl",
): PlanContext {
  const card = library.find((c) => c.id === cardId)!;
  return {
    locale,
    inputs: {
      innovationId: cardId,
      institution: "ops",
      gminaTeryt: teryt,
      staff: "2-3",
      budget: "200-600",
      timeframe: "12",
      groupSize: 40,
      needs: null,
      ...over,
    },
    card: toPlanCard(card),
    profile: buildProfile(byTeryt(teryt), gminas),
    gus: {
      name: "GUS, Bank Danych Lokalnych (API v1)",
      url: "https://bdl.stat.gov.pl/api/v1/data/by-unit/x",
      capturedAt: "2026-10-03T15:49:08.685Z",
      year: 2025,
      baseYear: 2015,
    },
    funding: [UW],
    ramowyPlan: { callId: UW.id, callName: UW.name, sourceUrl: UW.sourceUrl },
    generatedAt: "2026-10-03T12:00:00.000Z",
  };
}

const sectionNumbers = (md: string) =>
  [...md.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));

describe("GUS profile", () => {
  it("computes shares and the Małopolska median from gminas.json", () => {
    expect(gminas).toHaveLength(183);
    expect(share(1257, 28187)).toBe(4.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(medianShare80(gminas)).toBe(4);
  });

  it("flags depopulation plainly and leaves it null when GUS has no comparison", () => {
    const greboszow = buildProfile(byTeryt("1204032"), gminas);
    expect(greboszow.depopulating).toBe(true);
    expect(signedPct(greboszow.popChange10y!)).toBe("−8,6%");
    expect(signedPct(greboszow.popChange10y!, "en")).toBe("−8.6%");
    const szczawa = buildProfile(byTeryt("1207132"), gminas);
    expect(szczawa.popChange10y).toBeNull();
    expect(szczawa.depopulating).toBeNull();
  });

  it("features the rural, shrinking gmina with the highest 80+ share", () => {
    expect(featuredRuralGmina(gminas)?.name).toBe("Gręboszów");
  });

  it("puts a powiat in the locative", () => {
    expect(powiatLocative("powiat bocheński")).toBe("powiecie bocheńskim");
    expect(powiatLocative("Kraków")).toBe("Krakowie");
  });

  it("names gminas and powiats in plain English", () => {
    const g = byTeryt("1204032");
    expect(gminaLabel(g)).toBe("Gręboszów (gmina wiejska)");
    expect(gminaLabel(g, "en")).toBe("Gręboszów (rural municipality)");
    expect(powiatDisplay("powiat dąbrowski")).toBe("powiat dąbrowski");
    expect(powiatDisplay("powiat dąbrowski", "en")).toBe("Dąbrowa County");
    expect(powiatDisplay("Kraków")).toBe("miasto na prawach powiatu Kraków");
    expect(powiatDisplay("Kraków", "en")).toBe("Kraków (a city with county rights)");
    expect(optionLabels("en").budget["200-600"]).toBe("PLN 200,000–600,000");
    expect(optionLabels("pl").budget["200-600"]).toBe("200–600 tys. zł");
  });
});

describe("the printed recommendation rule", () => {
  const cards = library.map(toProfileCard);

  it("prints every rule that fired, with the numbers behind it", () => {
    const p = buildProfile(byTeryt("1204032"), gminas); // Gręboszów
    const s = profileSignals(p, []);
    expect(s.map((x) => x.id)).toEqual(["share80", "depopulation", "rural"]);
    expect(s[0]!.text).toContain("(7,4% wobec 4,0%)");
    expect(s[1]!.text).toContain("spadła o 8,6% w latach 2015–2025");
  });

  it("prints the rule in English with English numbers", () => {
    const p = buildProfile(byTeryt("1204032"), gminas);
    const s = profileSignals(p, [], { locale: "en" });
    expect(s[0]!.text).toContain("(7.4% against 4.0%)");
    expect(s[1]!.text).toContain("fell by 8.6% between 2015 and 2025");
    expect(s[2]!.text).toMatch(/^A rural municipality/);
    // Only the proper name „Małopolska" keeps its Polish letter.
    const text = s.map((x) => x.text).join(" ").replace(/Małopolsk\p{L}*/gu, "");
    expect(text).not.toMatch(/[ąćęłńóśźż]/);
  });

  it("only areas with ≥ 5 reported needs drive the rule", () => {
    const p = buildProfile(byTeryt("1261011"), gminas); // Kraków
    const s = profileSignals(p, [
      { area: "mental_health", count: 7 },
      { area: "homelessness", count: null },
    ]);
    const reported = s.filter((x) => x.id === "reported");
    expect(reported).toHaveLength(1);
    expect(reported[0]!.text).toContain("7 potrzeb");
    expect(reported[0]!.text).toContain("W Krakowie");
    expect(reported[0]!.themes).toEqual(["area:mental_health"]);
  });

  it("without needs (a public page) the rule never mentions reports", () => {
    const p = buildProfile(byTeryt("1261011"), gminas);
    expect(profileSignals(p).some((x) => x.id === "reported")).toBe(false);
  });

  it("gives an ageing, rural gmina seniors AND transport, each with a reason", () => {
    const p = buildProfile(byTeryt("1204032"), gminas);
    const recs = recommend(cards, profileSignals(p, []));
    expect(recs).toHaveLength(6);
    const themes = new Set(recs.flatMap((r) => r.matches.map((m) => m.theme)));
    expect(themes.has("seniors")).toBe(true);
    expect(themes.has("mobility")).toBe(true);
    expect(themes.has("digital")).toBe(true);
    for (const r of recs) {
      expect(r.matches.length).toBeGreaterThan(0);
      for (const m of r.matches) expect(m.evidence.length).toBeGreaterThan(5);
    }
    // „Mobilne centrum pomocy dla osób starszych" fits seniors + transport,
    // and the list leads with seniors, then getting around.
    expect(recs[0]!.card.id).toBe("c052");
    expect(recs[1]!.matches.map((m) => m.theme)).toContain("mobility");
  });

  it("explains a match in English, quoting the Polish word that made it", () => {
    const p = buildProfile(byTeryt("1204032"), gminas);
    const recs = recommend(cards, profileSignals(p, [], { locale: "en" }), {
      locale: "en",
    });
    expect(recs[0]!.card.id).toBe("c052");
    const labels = recs.flatMap((r) => r.matches.map((m) => m.label));
    expect(labels).toContain("Older people");
    expect(labels).toContain("Getting around");
    const mobility = recs.flatMap((r) => r.matches).find((m) => m.theme === "mobility")!;
    expect(mobility.evidence).toMatch(/^in the description: „.+”$/);
  });

  it("mobility means getting around, for disability or seniors cards only", () => {
    const card = (id: string) => cards.find((c) => c.id === id)!;
    // „Dostępna szermierka" mentions transport in passing.
    expect(matchTheme(card("c019"), "mobility")).toBeNull();
    // „aplikacja mobilna" / „urządzenie mobilne" are not mobility.
    expect(matchTheme(card("c008"), "mobility")).toBeNull();
    expect(matchTheme(card("c082"), "mobility")).toBeNull();
    // carrying a child in a shopping trolley is not transport.
    expect(matchTheme(card("c110"), "mobility")).toBeNull();
    expect(matchTheme(card("c021"), "mobility")?.evidence).toContain("Transport Publiczny");
    expect(matchTheme(card("c052"), "mobility")?.evidence).toContain("dojazdem");
  });

  it("falls back to cards selected for dissemination when nothing fires", () => {
    const fake = buildProfile(
      { ...byTeryt("1261011"), pop80: 1, popChange10y: 3 },
      gminas,
    );
    const s = profileSignals(fake, []);
    expect(s.map((x) => x.id)).toEqual(["none"]);
    const recs = recommend(cards, s);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => !!r.card.badge)).toBe(true);
  });
});

const ZERO = {
  seniors: 0,
  health: 0,
  family: 0,
  homelessness: 0,
  disability: 0,
  poverty: 0,
  migrants: 0,
  mental_health: 0,
};

describe("needs are for ROPS and the logged-in gmina only", () => {
  it("never publishes a count below 5", () => {
    const n = kAnonymize({
      total: 9,
      counts: {
        seniors: 5,
        health: 4,
        family: 0,
        homelessness: 0,
        disability: 0,
        poverty: 0,
        migrants: 0,
        mental_health: 1,
      },
      includesSample: false,
      since: "2026-07-05T00:00:00.000Z",
    });
    expect(n.total).toBe(9);
    expect(n.areas[0]).toEqual({ area: "seniors", count: 5 });
    expect(n.areas.find((a) => a.area === "health")!.count).toBeNull();
    expect(n.areas.find((a) => a.area === "mental_health")!.count).toBeNull();
    expect(
      kAnonymize({
        total: 4,
        counts: { ...ZERO, seniors: 4 },
        includesSample: false,
        since: n.since,
      }),
    ).toMatchObject({ total: null });
  });

  it("shows them to ROPS and a gmina login, never to the public or an expert", () => {
    expect(canSeeNeeds({ role: "rops" })).toBe(true);
    expect(canSeeNeeds({ role: "jst" })).toBe(true);
    expect(canSeeNeeds({ role: "expert" })).toBe(false);
    expect(canSeeNeeds(null)).toBe(false);
    expect(canSeeNeeds(undefined)).toBe(false);
  });
});

describe("template plan (no AI)", () => {
  const ctx = ctxFor("c066", "1204032"); // Organizator kompleksowej opieki, Gręboszów

  it("has all ten sections in order, the disclaimer and the sources", () => {
    const md = templatePlan(ctx);
    expect(sectionNumbers(md)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(md).toContain("Projekt planu przygotowany automatycznie — wymaga weryfikacji przez specjalistę ROPS");
    expect(md).toContain("ROPS ma już Ramowy Plan Wdrożenia tej innowacji");
    expect(md).toContain("## Źródła");
    expect(md).toContain(TODO);
    expect(md).toContain("z szablonu, bez udziału AI");
  });

  it("quotes only real card sentences, cited by section, never by internal id", () => {
    const md = templatePlan(ctx);
    expect(md).not.toMatch(/c\d{3}\.s\d+/);
    const quotes = [
      ...md.matchAll(/„([^”]+)” \*\(karta, sekcja „([^”]+)”\)\*/g),
    ];
    expect(quotes.length).toBeGreaterThan(3);
    const unescape = (t: string) => t.replace(/\\([\\*_`[\]|])/g, "$1");
    for (const q of quotes) {
      const s = ctx.card.sentences.find(
        (x) => x.text.replace(/\s+/g, " ").trim() === unescape(q[1]!),
      );
      expect(s, q[1]).toBeDefined();
      expect(q[2]).toBe(SECTION_LABEL[s!.section]);
    }
    expect(md).toContain("(karta, sekcja „Grupa docelowa”)");
  });

  it("section 2 carries the GUS figures and the share of 65+ for a seniors card", () => {
    const s2 = nb(templateSections(ctx)[2]);
    expect(s2).toContain("| Liczba mieszkańców |");
    expect(s2).toContain("−8,6% — ludność maleje");
    expect(s2).toContain("GUS, Bank Danych Lokalnych");
    expect(s2).toMatch(/To \d+,\d% mieszkańców gminy w wieku 65\+/);
  });

  it("section 7 is ranges only, each „do weryfikacji”, inside the chosen budget", () => {
    const s7 = nb(section7(ctx));
    const rows = s7.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Kategoria"));
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const r of rows) expect(r).toContain("do weryfikacji");
    expect(s7).toContain("90 000–360 000 zł"); // personnel 45–60% of 200–600 tys.
    expect(section7(ctxFor("c066", "1204032", { budget: "600+" }))).toContain(
      "wymaga dodatkowego źródła finansowania",
    );
  });

  it("section 10 states the real limit and status and is honest about closed calls", () => {
    const s10 = nb(section10(ctx));
    expect(s10).toContain("do 600 000 zł");
    expect(s10).toContain("**Zakończony**");
    expect(s10).toContain("była na liście");
    expect(s10).toContain("żaden nabór na wdrożenie usług");
    const other = section10({
      ...ctx,
      funding: [{ ...UW, includesInnovation: false }],
    });
    expect(other).toContain("nie było na liście");
  });

  it("puts the institution's own words in as a quote, never as instructions", () => {
    const md = templatePlan(ctxFor("c066", "1204032", { needs: "Mamy *dużo* seniorów" }));
    expect(md).toContain("> Mamy \\*dużo\\* seniorów");
  });
});

describe("template plan in English", () => {
  const ctx = ctxFor("c066", "1204032", {}, "en");
  const md = nb(templatePlan(ctx));

  it("has all ten sections with English headings, disclaimer and gap marker", () => {
    expect(sectionNumbers(md)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(md).toContain("# Framework Implementation Plan: “Home-based comprehensive care organiser”");
    expect(md).toContain("## 1. Aim of the service");
    expect(md).toContain("## 3. Description of the service, based on the innovation “Home-based comprehensive care organiser”");
    expect(md).toContain("## 10. Funding");
    expect(md).toContain("Draft plan prepared automatically — it must be checked by a ROPS specialist");
    expect(md).toContain("## Sources");
    expect(md).toContain(TODO_EN);
    expect(md).not.toContain(TODO);
    expect(md).toContain("from the template, without AI");
  });

  it("quotes the English card sentence for each id, labelled as translated", () => {
    const quotes = [
      ...md.matchAll(/“([^”]+)” \*\(card, section “([^”]+)”; translated from Polish\)\*/g),
    ];
    expect(quotes.length).toBeGreaterThan(3);
    const en = libraryEn.c066!;
    const unescape = (t: string) => t.replace(/\\([\\*_`[\]|])/g, "$1");
    for (const q of quotes) {
      const id = Object.keys(en.sentences).find(
        (k) => en.sentences[k]!.replace(/\s+/g, " ").trim() === unescape(q[1]!),
      );
      expect(id, q[1]).toBeDefined();
      const section = ctx.card.sentences.find((s) => s.id === id)!.section;
      expect(q[2]).toBe(SECTION_LABEL_EN[section]);
    }
    expect(md).toContain("(card, section “Target group”; translated from Polish)");
    expect(md).not.toMatch(/c\d{3}\.s\d+/);
  });

  it("falls back to the Polish sentence, labelled as such, when one is not translated", () => {
    const card = { ...ctx.card, en: { ...ctx.card.en!, sentences: {} } };
    const quotes = planSentences(card, "en");
    const first = quotes.get(ctx.card.sentences[0]!.id)!;
    expect(first.translated).toBe(false);
    expect(first.text).toBe(ctx.card.sentences[0]!.text);
    const out = templatePlan({ ...ctx, card });
    expect(out).toContain("Polish original, not yet translated");
  });

  it("writes figures, money and calls the English way", () => {
    expect(md).toContain("| Number of residents |");
    expect(md).toContain("−8.6% — the population is falling");
    expect(md).toContain("Gręboszów (rural municipality, Dąbrowa County)");
    expect(md).toContain("PLN 90,000–360,000"); // personnel 45–60% of PLN 200,000–600,000
    expect(md).toContain("| Budget | PLN 200,000–600,000 (to be verified) |");
    expect(md).toContain("Grant amount: up to PLN 600,000");
    expect(md).toContain("Status: **Closed**");
    expect(md).toContain("Programme: European Funds for Małopolska 2021-2027, Measure 6.23");
    expect(md).toContain("Usługa Wrażliwa – upowszechnianie innowacji społecznych w środowiskach lokalnych (call II)");
    expect(md).toContain("**was on the list**");
    expect(md).toContain("40 people");
    // Nothing of the Polish template leaks into the English plan.
    for (const pl of ["Cel usługi", "do weryfikacji", "mieszkańców", "Źródła", "zł"]) {
      expect(md, pl).not.toContain(pl);
    }
  });
});

describe("streamed AI plan assembly", () => {
  const make = (ctx: PlanContext) =>
    createPlanAssembler({
      header: planHeader(ctx),
      sections: templateSections(ctx),
      fixed: FIXED_SECTIONS,
      sentences: planSentences(ctx.card, ctx.locale),
      locale: ctx.locale,
      todo: todoMarker(ctx.locale),
      failureLines: FAILURE_LINES,
      footer: (source) => planFooter(ctx, source),
      trailer: planSourceMarker,
    });
  const run = (chunks: string[], ctx = ctxFor("c066", "1204032")) => {
    const a = make(ctx);
    let out = a.start();
    for (const c of chunks) out += a.push(c);
    out += a.end();
    return { out, fallbackUsed: a.fallbackUsed, source: a.source, failed: a.failed };
  };
  const ctx = ctxFor("c066", "1204032");
  const firstId = ctx.card.sentences[0]!.id;
  const firstText = ctx.card.sentences[0]!.text;
  const ALL_AI =
    "## 1. Cel\nA\n## 3. Opis\nB\n## 4. Etapy\nE\n## 5. Zespół\nZ\n## 6. Partnerzy\nP\n## 8. Ryzyka\nR\n## 9. Wskaźniki\nW\n";

  it("splices server sections in order and drops the model's preamble and title", () => {
    const model = [
      "Oto plan:\n# Mój tytuł\n",
      "## 1. Cel usługi\nCel A.\n## 3. Opis\nOpis B.\n",
      "## 4. Etapy\nE\n## 5. Zespół\nZ\n## 6. Partnerzy\nP\n## 8. Ryzyka\nR\n## 9. Wskaźniki\nW\n",
    ];
    const { out, fallbackUsed, source } = run(model);
    expect(fallbackUsed).toBe(false);
    expect(source).toBe("ai");
    expect(out).not.toContain("Oto plan");
    expect(out).not.toContain("Mój tytuł");
    expect(sectionNumbers(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // our heading wording, not the model's
    expect(out).toContain("## 3. Opis usługi na bazie innowacji „Organizator");
    expect(out).toContain("z pomocą Asystenta AI; liczby, budżet i nabory wstawił system");
    expect(readPlanSource(out)).toMatchObject({ source: "ai" });
  });

  it("replaces the model's own section 7 with ours (no invented money)", () => {
    const { out } = run([
      "## 1. Cel\nA\n## 7. Budżet\nKoszt: 123 456 zł\n## 8. Ryzyka\nR\n",
    ]);
    expect(out).not.toContain("123 456");
    expect(out).toContain("do weryfikacji");
  });

  it("resolves [[id]] to our sentence text and deletes unknown ids, across chunk borders", () => {
    const { out } = run([
      "## 1. Cel\n> [[",
      `${firstId}]]\n> [[c999.s1]]\nDalej.\n`,
    ]);
    expect(out).toContain(`„${firstText.replace(/\s+/g, " ").trim().slice(0, 20)}`);
    expect(out).toContain(
      `(karta, sekcja „${SECTION_LABEL[ctx.card.sentences[0]!.section]}”)`,
    );
    expect(out).not.toContain(firstId);
    expect(out).not.toContain("c999.s1");
  });

  it("scrubs sentence ids the model wrote in prose", () => {
    const { out } = run([
      `## 1. Cel\nJak mówi karta (zdanie ${firstId}), to działa ${firstId}.\n`,
    ]);
    expect(out).toContain("Jak mówi karta, to działa.");
    expect(out).not.toMatch(/c\d{3}\.s\d+/);
  });

  it("completes a plan the model abandoned, from the template, and says it is mixed", () => {
    const { out, fallbackUsed, source, failed } = run([
      "## 1. Cel\nA\n## 3. Opis\nB\n",
      "\n\n_Wystąpił błąd generowania. Spróbuj ponownie._",
    ]);
    expect(failed).toBe(true);
    expect(fallbackUsed).toBe(true);
    expect(source).toBe("mixed");
    expect(sectionNumbers(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out).not.toContain("Wystąpił błąd");
    expect(out).toContain("brakujące sekcje uzupełniono z szablonu");
    expect(readPlanSource(out)).toMatchObject({ source: "mixed" });
  });

  it("never prints a section the model was cut off in the middle of", () => {
    // The deadline aborts the model inside section 3: what it wrote of
    // section 3 is dropped and the template's section 3 stands in for it.
    const { out } = run([
      "## 1. Cel\nPełny cel.\n## 3. Opis\nPołowa zda",
      "\n\n_Wystąpił błąd generowania. Spróbuj ponownie._",
    ]);
    expect(out).toContain("Pełny cel.");
    expect(out).not.toContain("Połowa zda");
    expect(out).toContain("Na czym polega rozwiązanie (z karty):");
  });

  it("recognises every failure line aiStream writes, in Polish and in English", () => {
    expect(FAILURE_LINES.length).toBeGreaterThanOrEqual(6);
    for (const line of FAILURE_LINES) {
      const { out, source, failed } = run([`## 1. Cel\nA\n## 3. Opis\nB\n\n\n${line}`]);
      expect(failed, line).toBe(true);
      expect(source, line).toBe("mixed");
      expect(out, line).not.toContain(line);
      expect(sectionNumbers(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("a model that never answered is a template plan, and the footer says so", () => {
    // aiStream writes the unavailable line alone, with no newline.
    const { out, source } = run([AI_STREAM_LINES.pl.unavailable]);
    expect(source).toBe("template");
    expect(out).toContain("z szablonu, bez udziału AI");
    expect(out).not.toContain("z pomocą Asystenta AI");
    expect(readPlanSource(out)).toMatchObject({ source: "template" });
  });

  it("an empty section from the model is filled from the template", () => {
    const { out, source } = run([ALL_AI.replace("## 4. Etapy\nE\n", "## 4. Etapy\n\n")]);
    expect(source).toBe("mixed");
    expect(out).toContain("Harmonogram to propozycja do dopasowania.");
  });

  describe("in English", () => {
    const en = ctxFor("c066", "1204032", {}, "en");

    it("handles the English failure line and fills the rest in English", () => {
      const { out, source } = run(
        [
          "## 1. Aim\nA clear aim.\n## 3. Description\nHalf a sen",
          `\n\n${AI_STREAM_LINES.en.error}`,
        ],
        en,
      );
      expect(source).toBe("mixed");
      expect(out).not.toContain(AI_STREAM_LINES.en.error);
      expect(out).not.toContain("Half a sen");
      expect(sectionNumbers(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(out).toContain("## 1. Aim of the service");
      expect(out).toContain("What the solution is (from the card):");
      expect(out).toContain("partly with the help of the AI assistant");
      expect(readPlanSource(out).markdown).not.toContain("plan-source");
    });

    it("quotes the translated sentence and swaps the Polish gap marker", () => {
      const { out, source } = run(
        [
          `## 1. Aim\n> [[${firstId}]]\nStart date: [DO UZUPEŁNIENIA]\n`,
          "## 3. D\nB\n## 4. E\nE\n## 5. T\nT\n## 6. P\nP\n## 8. R\nR\n## 9. I\nI\n",
        ],
        en,
      );
      expect(source).toBe("ai");
      const enText = libraryEn.c066!.sentences[firstId]!.replace(/\s+/g, " ").trim();
      expect(out).toContain(`“${enText.slice(0, 30)}`);
      expect(out).toContain("; translated from Polish)*");
      expect(out).toContain(`Start date: ${TODO_EN}`);
      expect(out).not.toContain(TODO);
      expect(out).toContain("with the help of the AI assistant; figures, budget and calls");
    });
  });
});

describe("plan source marker", () => {
  it("is read and removed, also while it is still arriving", () => {
    const body = `# Plan\n\ntext\n${planSourceMarker("mixed")}`;
    expect(readPlanSource(body)).toEqual({ markdown: "# Plan\n\ntext\n", source: "mixed" });
    expect(readPlanSource("# Plan\n\ntext\n\n<!-- plan-sou")).toEqual({
      markdown: "# Plan\n\ntext\n",
      source: null,
    });
    expect(readPlanSource("# Plan")).toEqual({ markdown: "# Plan", source: null });
  });
});

describe("stored plan and validation", () => {
  it("labels a stored plan's details in the reader's language", () => {
    const raw = {
      markdown: "# Plan",
      mode: "mixed",
      locale: "en",
      inputs: { institution: "ngo", staff: "4-6", budget: "to50", timeframe: "6", groupSize: 12 },
      innovationTitle: "Home-based comprehensive care organiser",
      gminaName: "Gręboszów",
    };
    const en = readStoredPlan(raw, "en")!;
    expect(en.source).toBe<PlanSource>("mixed");
    expect(en.locale).toBe("en");
    expect(en.details).toContainEqual({ label: "Budget (to be verified)", value: "up to PLN 50,000" });
    const pl = readStoredPlan(raw, "pl")!;
    expect(pl.details).toContainEqual({ label: "Zespół", value: "4–6 osób" });
    expect(readStoredPlan({ mode: "ai" }, "pl")).toBeNull();
    expect(readStoredPlan({ markdown: "x" }, "pl")?.locale).toBe("pl");
  });

  it("validation messages are keys the screens translate", () => {
    const r = planInputSchema.safeParse({ innovationId: "c066", gminaTeryt: "9999999" });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toContain("institution");
    expect(messages).toContain("gmina");
  });
});
