/**
 * The committed data files must match their schemas, and the small pure helpers behind them must
 * keep doing what the files rely on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { orgKey, orgType } from "./build-network";
import { terytFromBdlId } from "./fetch-gus";
import { Calls, Canvas, Gminas, Knowledge, Learn, Library, LibraryWithheld, Network, Powiaty } from "./schemas";

const read = (f: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", f), "utf8"));

describe("data files match their schemas", () => {
  it.each([
    ["library.json", Library],
    ["library.withheld.json", LibraryWithheld],
    ["knowledge.json", Knowledge],
    ["calls.json", Calls],
    ["canvas.json", Canvas],
    ["powiaty.json", Powiaty],
    ["gminas.json", Gminas],
    ["learn.json", Learn],
    ["network.json", Network],
  ] as const)("%s", (file, schema) => {
    expect(() => schema.parse(read(file))).not.toThrow();
  });

  it("library ids are unique and every network/call reference resolves", () => {
    const lib = Library.parse(read("library.json"));
    const ids = new Set(lib.map((c) => c.id));
    expect(ids.size).toBe(lib.length);
    for (const o of Network.parse(read("network.json")).orgs) for (const id of o.innovationIds) expect(ids.has(id)).toBe(true);
    for (const c of Calls.parse(read("calls.json"))) for (const i of c.innovations) expect(i.cardId && ids.has(i.cardId)).toBe(true);
  });

  it("every gmina sits in one of the 22 powiats", () => {
    const powiaty = new Set(Powiaty.parse(read("powiaty.json")).map((p) => p.teryt));
    for (const g of Gminas.parse(read("gminas.json"))) expect(powiaty.has(g.powiatTeryt)).toBe(true);
  });
});

describe("helpers", () => {
  it("derives TERYT from a BDL unit id", () => {
    expect(terytFromBdlId("011212161011")).toBe("1261011"); // Kraków
    expect(terytFromBdlId("011216911033")).toBe("1211033"); // Czarny Dunajec
  });

  it("classifies organisations by name", () => {
    expect(orgType("Gmina Kęty/ OPS w Kętach")).toBe("ops");
    expect(orgType("Gmina Miechów")).toBe("jst");
    expect(orgType('"Rzecz Piękna" Fundacja Rozwoju Wydziału Form Przemysłowych ASP w Krakowie')).toBe("fundacja");
    expect(orgType("Stowarzyszenie „Razem przy Specjalnym Ośrodku Szkolno-Wychowawczym w Siedlcach”")).toBe("stowarzyszenie");
    expect(orgType("Politechnika Krakowska")).toBe("uczelnia");
    expect(orgType("Karpatia Sp. z o. o")).toBe("firma");
    expect(orgType("Instytut Spraw Głuchych")).toBe("inna");
  });

  it("merges spelling variants of one organisation, and only those", () => {
    expect(orgKey("Fundacja Human Doc")).toBe(orgKey("Fundacja HumanDoc"));
    expect(orgKey("Stowarzyszenie Edukacja Praktyczna TKK")).toBe(orgKey("Stowarzyszenie Edukacja Praktyczna T.K.K."));
    expect(orgKey("Politechnika Krakowska")).not.toBe(orgKey("Politechnika Krakowska im. Tadeusza Kościuszki"));
  });
});
