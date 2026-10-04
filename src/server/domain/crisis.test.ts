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

describe("detectCrisis: English", () => {
  it.each([
    ["I want to die.", "suicide"],
    ["My son has suicidal thoughts", "suicide"],
    ["She said she would kill herself", "suicide"],
    ["I don't want to live anymore", "suicide"],
    ["Dad wants to end his life", "suicide"],
    ["there's no reason to live", "suicide"],
    ["My daughter is self-harming", "self_harm"],
    ["he cuts himself", "self_harm"],
    ["My husband hits me", "violence"],
    ["He beats my mum every week", "violence"],
    ["He threatened to kill us", "violence"],
    ["there is domestic violence at home", "violence"],
    ["I fear for my life", "violence"],
    ["Grandma is not breathing", "danger"],
    ["my neighbour is unconscious", "danger"],
    ["I think she took an overdose", "danger"],
    ["We have no food left", "danger"],
    ["He hasn't eaten for days", "danger"],
    ["It's winter and he has nowhere to sleep", "danger"],
    ["Our neighbour hits his children", "child"],
    ["the kids next door are always hungry", "child"],
  ])("flags %s", (text, category) => {
    const r = detectCrisis(text);
    expect(r.urgent).toBe(true);
    expect(r.categories).toContain(category);
  });

  it.each([
    "Is there a suicide prevention programme for schools?",
    "I run domestic violence training for social workers.",
    "self-harm awareness campaign",
    "He has nowhere to sleep at the moment",
    "Is there a food bank near us? We have no food bank in the village.",
    "My mum is 73, lives alone and mixes up her pills.",
    "My son has depression and won't go to school.",
    "The office is not responding to my letters.",
  ])("does not flag %s", (text) => {
    expect(detectCrisis(text).urgent).toBe(false);
  });

  it("still flags a personal mention next to a programme mention", () => {
    const r = detectCrisis("My son has suicidal thoughts. Is there a suicide prevention programme?");
    expect(r.urgent).toBe(true);
    expect(r.matched).toEqual(["suicidal"]);
  });
});

describe("CRISIS_RESOURCES: English", () => {
  it("has an English name and description for every number, hours only where the operator states them", () => {
    for (const r of CRISIS_RESOURCES) {
      expect(r.en.name.length).toBeGreaterThan(0);
      expect(r.en.who.length).toBeGreaterThan(10);
      expect(r.en.hours === null).toBe(r.hours === null);
    }
  });
});

describe("detectCrisis: English, someone collapsed", () => {
  it("flags a person lying and not responding", () => {
    expect(detectCrisis("Grandad is lying on the floor and not responding").categories).toContain("danger");
  });
});
