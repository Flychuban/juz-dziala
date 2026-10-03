import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SECTION_LABEL } from "~/lib/domain";
import type { LibraryCard } from "~/server/domain/types";
import { kAnonymize } from "./needs-count";
import { createPlanAssembler } from "./plan-stream";
import {
  FIXED_SECTIONS,
  planFooter,
  planHeader,
  section10,
  section7,
  templatePlan,
  templateSections,
  TODO,
} from "./plan-template";
import {
  buildProfile,
  featuredRuralGmina,
  median,
  matchTheme,
  medianShare80,
  powiatLocative,
  profileSignals,
  recommend,
  share,
  signedPct,
  type ProfileCard,
} from "./profile";
import type { FundingCall, Gmina, PlanCard, PlanContext } from "./types";

const gminas = JSON.parse(readFileSync("data/gminas.json", "utf8")) as Gmina[];
const library = JSON.parse(
  readFileSync("data/library.json", "utf8"),
) as LibraryCard[];

/** Intl pl-PL groups digits with a no-break space. */
const nb = (s: string) => s.replace(/\u00a0/g, " ");
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
};

function ctxFor(cardId: string, teryt: string, over: Partial<PlanContext["inputs"]> = {}): PlanContext {
  const card = library.find((c) => c.id === cardId)!;
  return {
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

  it("only areas with ≥ 5 reported needs drive the rule", () => {
    const p = buildProfile(byTeryt("1261011"), gminas); // Kraków
    const s = profileSignals(p, [
      { area: "mental_health", count: 7 },
      { area: "homelessness", count: null },
    ]);
    const reported = s.filter((x) => x.id === "reported");
    expect(reported).toHaveLength(1);
    expect(reported[0]!.text).toContain("7 potrzeb");
    expect(reported[0]!.themes).toEqual(["area:mental_health"]);
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

describe("k-anonymity", () => {
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
});

describe("template plan (no AI)", () => {
  const ctx = ctxFor("c066", "1204032"); // Organizator kompleksowej opieki, Gręboszów

  it("has all ten sections in order, the disclaimer and the sources", () => {
    const md = templatePlan(ctx);
    const numbers = [...md.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(md).toContain("Projekt planu przygotowany automatycznie — wymaga weryfikacji przez specjalistę ROPS");
    expect(md).toContain("ROPS ma już Ramowy Plan Wdrożenia tej innowacji");
    expect(md).toContain("## Źródła");
    expect(md).toContain(TODO);
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

describe("streamed AI plan assembly", () => {
  const ctx = ctxFor("c066", "1204032");
  const sentences = new Map(ctx.card.sentences.map((s) => [s.id, s]));
  const make = () =>
    createPlanAssembler({
      header: planHeader(ctx),
      sections: templateSections(ctx),
      fixed: FIXED_SECTIONS,
      sentences,
      footer: ({ fallbackUsed }) => planFooter(ctx, "ai", { fallbackUsed }),
    });
  const run = (chunks: string[]) => {
    const a = make();
    let out = a.start();
    for (const c of chunks) out += a.push(c);
    out += a.end();
    return { out, fallbackUsed: a.fallbackUsed };
  };
  const firstId = ctx.card.sentences[0]!.id;
  const firstText = ctx.card.sentences[0]!.text;

  it("splices server sections in order and drops the model's preamble and title", () => {
    const model = [
      "Oto plan:\n# Mój tytuł\n",
      "## 1. Cel usługi\nCel A.\n## 3. Opis\nOpis B.\n",
      "## 4. Etapy\nE\n## 5. Zespół\nZ\n## 6. Partnerzy\nP\n## 8. Ryzyka\nR\n## 9. Wskaźniki\nW\n",
    ];
    const { out, fallbackUsed } = run(model);
    expect(fallbackUsed).toBe(false);
    expect(out).not.toContain("Oto plan");
    expect(out).not.toContain("Mój tytuł");
    const numbers = [...out.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // our heading wording, not the model's
    expect(out).toContain("## 3. Opis usługi na bazie innowacji „Organizator");
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

  it("completes a plan the model abandoned, from the template", () => {
    const { out, fallbackUsed } = run([
      "## 1. Cel\nA\n## 3. Opis\nB\n",
      "\n\n_Wystąpił błąd generowania. Spróbuj ponownie._",
    ]);
    expect(fallbackUsed).toBe(true);
    const numbers = [...out.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out).not.toContain("Wystąpił błąd");
    expect(out).toContain("brakujące sekcje uzupełniono z szablonu");
  });
});
