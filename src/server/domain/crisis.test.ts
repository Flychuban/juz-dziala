import { describe, expect, it } from "vitest";
import { CRISIS_RESOURCES, detectCrisis } from "./crisis";

describe("detectCrisis: urgent texts", () => {
  it.each([
    ["Nie chcę już żyć.", "suicide"],
    ["nie chce zyc", "suicide"],
    ["NIE CHCĘ DŁUŻEJ ŻYĆ", "suicide"],
    ["Mama mówi, że nie chce jej się już żyć", "suicide"],
    ["Nie chce mi się żyć", "suicide"],
    ["Syn ma myśli samobójcze", "suicide"],
    ["myślę o samobójstwie", "suicide"],
    ["Chcę odebrać sobie życie", "suicide"],
    ["Boję się, że tata się zabije", "suicide"],
    ["zabiję się", "suicide"],
    ["Chcę skończyć ze sobą", "suicide"],
    ["Brat próbował targnąć się na życie", "suicide"],
    ["chcę umrzeć", "suicide"],
    ["Nie widzę sensu życia", "suicide"],
    ["Córka się tnie", "self_harm"],
    ["ona tnie się żyletką", "self_harm"],
    ["zauważyłam samookaleczenia u syna", "self_harm"],
    ["Mąż mnie bije", "violence"],
    ["on bije ją codziennie", "violence"],
    ["Grozi mi śmiercią", "violence"],
    ["sąsiad grozi, że mnie zabije", "violence"],
    ["W domu jest przemoc domowa", "violence"],
    ["ojczym znęca się nad mamą", "violence"],
    ["Boję się o swoje życie", "violence"],
    ["Tata leży i nie oddycha", "danger"],
    ["Babcia leży na podłodze i nie odpowiada", "danger"],
    ["dziadek jest nieprzytomny", "danger"],
    ["chyba przedawkowała leki", "danger"],
    ["Ojciec bije dzieci", "child"],
    ["sąsiad molestuje dziecko", "child"],
    ["dzieci sąsiadów są ciągle głodne", "child"],
  ])("flags %s", (text, category) => {
    const r = detectCrisis(text);
    expect(r.urgent).toBe(true);
    expect(r.categories).toContain(category);
    expect(r.matched.length).toBeGreaterThan(0);
  });

  it("returns the matched phrase as written (lowercase, diacritics kept)", () => {
    expect(detectCrisis("Mama: „Nie chcę już żyć”.").matched).toEqual(["nie chcę już żyć"]);
  });

  it("still flags a personal mention next to a programme mention", () => {
    const r = detectCrisis("Syn ma myśli samobójcze. Czy jest jakiś program zapobiegania samobójstwom?");
    expect(r.urgent).toBe(true);
    expect(r.matched).toEqual(["samobójcze"]);
  });
});

describe("detectCrisis: neutral texts", () => {
  it.each([
    "Szukam materiałów: profilaktyka samobójstw wśród młodzieży.",
    "Czy jest program zapobiegania samobójstwom dla szkół?",
    "Prowadzę szkolenie z przeciwdziałania przemocy domowej.",
    "kampania profilaktyki samookaleczeń",
    "Urząd nie odpowiada na moje pisma od miesiąca.",
    "Ta oferta mi nie odpowiada.",
    "Serce mi mocno bije, kiedy idę do lekarza.",
    "Zegar na wieży bije w południe.",
    "Długo biję się z myślami, czy prosić o pomoc.",
    "Mama ma 73 lata, mieszka sama i myli leki.",
    "Syn ma depresję i nie chce chodzić do szkoły.",
    "",
  ])("does not flag %s", (text) => {
    expect(detectCrisis(text)).toEqual({ urgent: false, matched: [], categories: [] });
  });
});

describe("CRISIS_RESOURCES", () => {
  it("lists only verified entries with a source and the verification date", () => {
    expect(CRISIS_RESOURCES.map((r) => r.phone)).toEqual(["112", "800 70 2222", "116 111", "116 123"]);
    for (const r of CRISIS_RESOURCES) {
      expect(r.sourceUrl).toMatch(/^https:\/\//);
      expect(r.verifiedAt).toBe("2026-10-03");
      expect(r.evidence.length).toBeGreaterThan(20);
      expect(r.name.length).toBeGreaterThan(0);
    }
  });

  it("does not state hours that the operator did not state", () => {
    expect(CRISIS_RESOURCES.find((r) => r.phone === "112")?.hours).toBeNull();
  });
});
