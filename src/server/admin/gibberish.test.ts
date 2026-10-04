import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { looksLikeGibberish } from "./gibberish";

const library = JSON.parse(
  readFileSync(join(process.cwd(), "data", "library.json"), "utf8"),
) as { title: string; sentences: { id: string; text: string }[] }[];

// The sample needs live in a server-only module tree; read them as text.
const sampleNeeds = [
  ...readFileSync(
    join(process.cwd(), "src", "server", "admin", "sample-needs.ts"),
    "utf8",
  ).matchAll(/^\s{4}"([^"]{12,})",$/gmu),
].map((m) => m[1]!);

describe("looksLikeGibberish", () => {
  it.each([
    "asdsadsad",
    "asdsadsadasdsad sadasd",
    "Szukaj rozwiązań Szukaj rozwiązań",
    "Szukaj rozwiązań Szukaj rozwiązań Szukaj rozwiązań",
    "qwerty",
    "qwertyuiop",
    "sdfsdfsdf",
    "jkhjkhkjh",
    "hahahaha",
    "xxxxxxx",
    "test test test",
    "pomoc pomoc pomoc",
    "aa",
    "???",
    "123456",
    "bcdfgh klmn",
    "dfgdfgdfg dfgdfg",
  ])("flags „%s”", (text) => {
    expect(looksLikeGibberish(text)).toBe(true);
  });

  it.each([
    "Samotność seniora",
    "Bezdomność",
    "Przemoc w rodzinie",
    "Mama ma 82 lata, mieszka sama na wsi i całymi dniami z nikim nie rozmawia.",
    "Brak dowozu do lekarza.",
    "Chrząszcz brzmi w trzcinie",
    "My mother needs help at home after a fall.",
    "Szukam opieki wytchnieniowej dla syna z autyzmem.",
    "Przyszłość młodzieży w małych gminach",
  ])("keeps a real need: „%s”", (text) => {
    expect(looksLikeGibberish(text)).toBe(false);
  });

  it("keeps every sample need", () => {
    expect(sampleNeeds.length).toBeGreaterThan(40);
    expect(sampleNeeds.filter(looksLikeGibberish)).toEqual([]);
  });

  it("keeps every library title and sentence", () => {
    const texts = library.flatMap((c) => [
      c.title,
      ...c.sentences.map((s) => s.text),
    ]);
    // Very short fragments (list items, names) are not needs; skip them.
    const flagged = texts
      .filter((t) => (t.match(/\p{L}/gu) ?? []).length >= 20)
      .filter(looksLikeGibberish);
    expect(flagged).toEqual([]);
  });
});
