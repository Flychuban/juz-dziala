import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { SectionKey } from "~/lib/domain";
import type { CardSentence, InnovationEn } from "~/server/db/schema";
import { freshEnglish, layoutLike, localizeCard, sourceShaOf } from "./english";

type Card = {
  id: string;
  title: string;
  sections: Record<SectionKey, string>;
  sentences: CardSentence[];
  keywords: string[];
  categoryLabels: string[];
  badge: string | null;
};

const read = <T>(f: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "data", f), "utf8")) as T;

/** Postgres jsonb stores keys shorter-first, then bytewise — not in insertion order. */
function jsonbOrder<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).sort(
      ([a], [b]) => a.length - b.length || (a < b ? -1 : 1),
    ),
  ) as T;
}

describe("sourceShaOf", () => {
  const cards = read<Card[]>("library.json");
  const en = read<Record<string, InnovationEn>>("library.en.json");

  it("matches the translation script's hash even after jsonb reorders the sections", () => {
    const stale = cards.filter(
      (c) =>
        en[c.id] &&
        sourceShaOf(jsonbOrder(c.sections), c.title) !== en[c.id]!.sourceSha,
    );
    expect(stale.map((c) => c.id)).toEqual([]);
  });

  it("treats an edited card as stale", () => {
    const c = cards[0]!;
    const edited = {
      ...c,
      en: en[c.id]!,
      sections: {
        ...c.sections,
        solution: `${c.sections.solution} Nowe zdanie.`,
      },
    };
    expect(freshEnglish({ ...c, en: en[c.id]! })).not.toBeNull();
    expect(freshEnglish(edited)).toBeNull();
  });
});

describe("layoutLike", () => {
  it("keeps paragraph breaks and list markers of the Polish text", () => {
    expect(
      layoutLike(
        "Elementy:\n\n-\n\nbus;\n\n-\n\ndom.",
        [
          { pl: "Elementy:", en: "Parts:" },
          { pl: "bus;", en: "a bus;" },
          { pl: "dom.", en: "a home." },
        ],
        "Parts: a bus; a home.",
      ),
    ).toBe("Parts:\n\n-\n\na bus;\n\n-\n\na home.");
  });
  it("falls back when Polish words would be left between sentences", () => {
    expect(
      layoutLike(
        "Raz. Coś. Dwa.",
        [
          { pl: "Raz.", en: "One." },
          { pl: "Dwa.", en: "Two." },
        ],
        "One. Two.",
      ),
    ).toBe("One. Two.");
  });
});

describe("localizeCard", () => {
  const cards = read<Card[]>("library.json");
  const en = read<Record<string, InnovationEn>>("library.en.json");
  const c = cards.find((x) => x.sections.solution.includes("\n"))!;

  it("returns the Polish card in Polish mode", () => {
    expect(localizeCard({ ...c, en: en[c.id]! }, "pl").lang).toBe("pl");
  });
  it("returns English with every sentence translated in English mode", () => {
    const v = localizeCard({ ...c, en: en[c.id]! }, "en");
    expect(v.lang).toBe("en");
    expect(v.title).toBe(en[c.id]!.title);
    expect(v.sentences.map((s) => s.text)).toEqual(
      c.sentences.map((s) => en[c.id]!.sentences[s.id]),
    );
    expect(v.sections.solution).toContain("\n");
  });
  it("falls back to Polish (glossary category labels kept) when the translation is missing or stale", () => {
    const missing = localizeCard({ ...c, en: null }, "en");
    expect(missing.lang).toBe("pl");
    expect(missing.title).toBe(c.title);
    const stale = localizeCard(
      { ...c, title: `${c.title}!`, en: en[c.id]! },
      "en",
    );
    expect(stale.lang).toBe("pl");
    expect(stale.categoryLabels).toEqual(en[c.id]!.categoryLabels);
  });
});
