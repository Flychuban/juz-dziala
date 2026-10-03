import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIIS_LICENCE,
  buildCard,
  canonicalYouTube,
  licenceFromUrl,
  mapaAreasFor,
  parseCardHtml,
  splitSentences,
} from "./ingest-library";
import { AND_PRIVATE_PERSONS, PRIVATE_PERSONS, anonymiseAuthors } from "./lib/authors";
import { LibraryCard } from "./schemas";

const URL_ =
  "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/dla-osob-z-niepelnosprawnoscia-sensoryczna,teleasystent";
const html = readFileSync(join(import.meta.dirname, "fixtures", "card-teleasystent.html"), "utf8");

describe("parseCardHtml — archived Teleasystent page", () => {
  const parsed = parseCardHtml(html, URL_);

  it("reads the title and the badge", () => {
    expect(parsed.title).toBe("Teleasystent");
    expect(parsed.badge).toBe(
      'INNOWACJA WYBRANA DO UPOWSZECHNIANIA W RAMACH PROJEKTU "MAŁOPOLSKI INKUBATOR INNOWACJI SPOŁECZNYCH"',
    );
  });

  it("finds all six sections, including a heading written as a plain <p>", () => {
    expect(parsed.sections.solution.startsWith("Aplikacja na smartfon")).toBe(true);
    expect(parsed.sections.problems.startsWith("Innowacja odpowiada na ograniczone zasoby")).toBe(true);
    expect(parsed.sections.targetGroup).toBe("Osoby niewidome");
    expect(parsed.sections.whoCanUse.startsWith("Z rozwiązania mogą skorzystać")).toBe(true);
    expect(parsed.sections.doesItWork.startsWith("Test innowacji wykazał wysoką skuteczność.")).toBe(true);
    expect(parsed.warnings).toEqual([]);
  });

  it("normalises whitespace: no NBSP, no doubled spaces, no trailing space", () => {
    for (const text of Object.values(parsed.sections)) {
      expect(text).not.toMatch(/ | {2,}|\s$/);
    }
  });

  it("maps the button table by caption", () => {
    expect(parsed.buttons.videoUrl).toBe("https://www.youtube.com/watch?v=8xUBVF_5CWU");
    expect(parsed.buttons.folderUrl).toBe("https://rops.krakow.pl/mpliki/IS/BIBLIOTEKA_INNOWACJI_SPOECZNYCH/08_model_Teleasystent.pdf");
    expect(parsed.buttons.materialsUrl).toBe("https://rops.krakow.pl/pliki/IS/bibloteka/teleasystent.zip");
    expect(parsed.buttons.licenceUrl).toBe(
      "https://rops.krakow.pl/mpliki/IS/BIBLIOTEKA_INNOWACJI_SPOECZNYCH/Zasady_wykorzystania_innowacji_MIIS.pdf",
    );
    expect(parsed.buttons.licence).toBe(MIIS_LICENCE);
  });

  it("builds a schema-valid card with the organisation kept and the people removed", () => {
    const card = buildCard(
      "c093",
      "teleasystent",
      parsed,
      ["dla-osob-z-niepelnosprawnoscia-sensoryczna"],
      ["Dla osób z niepełnosprawnością sensoryczną"],
      { sourceUrl: URL_, capturedAt: "2026-10-03T15:28:57.645Z", sha256: "25d1215ce2820d33535520a204bcf56ea62f4f448e255b18770b74157d4101b2" },
    );
    expect(() => LibraryCard.parse(card)).not.toThrow();
    expect(card.sections.authors).toBe(
      `Chrześcijańskie Stowarzyszenie Osób Niepełnosprawnych, Ich Rodzin i Przyjaciół OGNISKO\n${AND_PRIVATE_PERSONS}`,
    );
    const everything = JSON.stringify(card);
    for (const name of ["Jan Przykładowy", "Anna Testowa", "Piotr Fikcyjny"]) expect(everything).not.toContain(name);

    expect(card.mapaAreas).toEqual(["disability"]);
    expect(card.sentences[0]).toEqual({
      id: "c093.s1",
      section: "solution",
      text: "Aplikacja na smartfon, przy pomocy której asystent/osoba wspierająca może udzielać zdalnego wsparcia będącego połączeniem wideo rozmowy z nawigacją ,,na żywo” w terenie.",
    });
    // "np." inside the third sentence must not split it
    expect(card.sentences[2]!.text).toBe(
      "Może to być czynność związana z zainteresowaniami uczestnika lub wsparcie incydentalne dotyczące np. opieki nad dzieckiem.",
    );
    expect(card.sentences.map((s) => s.id)).toEqual(card.sentences.map((_, i) => `c093.s${i + 1}`));
    const lower = [card.title, ...Object.values(card.sections)].join(" ").toLowerCase();
    for (const k of card.keywords) expect(lower).toContain(k);
  });
});

describe("splitSentences", () => {
  it("does not split after Polish abbreviations, initials or ordinals", () => {
    expect(
      splitSentences("Działa m.in. w Krakowie, ok. 20 osób, tzw. model. W 2023 r. Gmina dołączyła. Koszt 100 zł. Nowe 3. edycja trwa."),
    ).toEqual(["Działa m.in. w Krakowie, ok. 20 osób, tzw. model.", "W 2023 r. Gmina dołączyła.", "Koszt 100 zł. Nowe 3. edycja trwa."]);
  });

  it("splits on ! and ?, before quotes, on line breaks and bullets", () => {
    expect(splitSentences("Czy to działa? Tak! „Nowy” etap.\n- pierwszy punkt\n- drugi punkt")).toEqual([
      "Czy to działa?",
      "Tak!",
      "„Nowy” etap.",
      "pierwszy punkt",
      "drugi punkt",
    ]);
  });

  it("re-joins a <br> that falls mid-sentence", () => {
    expect(splitSentences("Co ważne, koszty\neksploatacyjne pozostają bez zmian.")).toEqual([
      "Co ważne, koszty eksploatacyjne pozostają bez zmian.",
    ]);
  });
});

describe("anonymiseAuthors", () => {
  it("replaces a people-only list", () => {
    expect(anonymiseAuthors("- Jan Przykładowy\n\n- Anna Testowa").text).toBe(PRIVATE_PERSONS);
    expect(anonymiseAuthors("dr hab. inż. Anna Testowa-Nowa").text).toBe(PRIVATE_PERSONS);
    expect(anonymiseAuthors("Jan Przykładowy, Piotr Fikcyjny").text).toBe(PRIVATE_PERSONS);
  });

  it("keeps organisations, including company forms and a misspelt Fundacja", () => {
    expect(anonymiseAuthors("Karpatia Sp. z o. o").text).toBe("Karpatia Sp. z o. o");
    expect(anonymiseAuthors('Fudacja "Aprobata"').text).toBe('Fudacja "Aprobata"');
    expect(anonymiseAuthors("Fundacja „Mam dom”:\n\n- Anna Testowa").text).toBe(`Fundacja „Mam dom”\n${AND_PRIVATE_PERSONS}`);
  });

  it("removes a person's name embedded in a business name, but not a patron", () => {
    expect(anonymiseAuthors("Instytut HR Ewa Przykładowa-Testowa").text).toBe(`Instytut HR\n${AND_PRIVATE_PERSONS}`);
    expect(anonymiseAuthors("Politechnika Krakowska im. Tadeusza Kościuszki").text).toBe(
      "Politechnika Krakowska im. Tadeusza Kościuszki",
    );
  });

  it("leaves an empty section empty", () => {
    expect(anonymiseAuthors("").text).toBe("");
  });
});

describe("small helpers", () => {
  it("canonicalises YouTube links", () => {
    expect(canonicalYouTube("https://youtu.be/o7UhDlebLJo")).toBe("https://www.youtube.com/watch?v=o7UhDlebLJo");
    expect(canonicalYouTube("https://www.youtube.com/embed/o7UhDlebLJo?rel=0")).toBe("https://www.youtube.com/watch?v=o7UhDlebLJo");
    expect(canonicalYouTube("https://vimeo.com/123")).toBeNull();
  });

  it("reads Creative Commons licences and nothing else", () => {
    expect(licenceFromUrl("https://creativecommons.org/licenses/by/4.0/deed.pl")).toBe("CC BY 4.0");
    expect(licenceFromUrl("https://creativecommons.org/licenses/by-nc-sa/4.0/")).toBe("CC BY-NC-SA 4.0");
    expect(licenceFromUrl("https://example.org/licencja.pdf")).toBeNull();
  });

  it("adds mental_health only from solution/problems/targetGroup", () => {
    const empty = { solution: "", problems: "", targetGroup: "", whoCanUse: "", doesItWork: "", authors: "" };
    expect(mapaAreasFor(["dla-seniorow"], { ...empty, problems: "ryzyko depresji u seniorów" })).toEqual(["mental_health", "seniors"]);
    expect(mapaAreasFor(["dla-seniorow"], { ...empty, whoCanUse: "szpitale psychiatryczne" })).toEqual(["seniors"]);
    expect(mapaAreasFor(["dla-rynku-pracy"], { ...empty, solution: "osoby w kryzysie psychicznym" })).toEqual(["poverty", "mental_health"]);
  });
});
