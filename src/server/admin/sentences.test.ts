import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { splitSentences as ingestSplit } from "../../../scripts/ingest-library";
import { SECTION_KEYS, type SectionKey } from "~/lib/domain";
import {
  rederiveSentences,
  splitSentences,
  type CardSentence,
} from "./sentences";

type Card = {
  id: string;
  sections: Record<SectionKey, string>;
  sentences: CardSentence[];
};
const library = JSON.parse(readFileSync("data/library.json", "utf8")) as Card[];

describe("splitSentences", () => {
  it("matches the ingest rules on every section of the library", () => {
    let checked = 0;
    for (const card of library) {
      for (const key of SECTION_KEYS) {
        expect(splitSentences(card.sections[key])).toEqual(
          ingestSplit(card.sections[key]),
        );
        checked++;
      }
    }
    expect(checked).toBe(library.length * SECTION_KEYS.length);
  });

  it("keeps abbreviations and initials inside one sentence", () => {
    expect(splitSentences("Działa m.in. w Bochni. Prowadzi J. Nowak.")).toEqual(
      ["Działa m.in. w Bochni.", "Prowadzi J. Nowak."],
    );
  });
});

describe("rederiveSentences", () => {
  it("reproduces the published ids when nothing changed", () => {
    for (const card of library.slice(0, 40)) {
      const r = rederiveSentences(card.id, card.sentences, card.sections);
      expect(r.sentences).toEqual(card.sentences);
      expect(r.added).toEqual([]);
      expect(r.removed).toEqual([]);
    }
  });

  it("keeps unchanged ids, appends new ids and reports removed ones", () => {
    const prev: CardSentence[] = [
      { id: "c900.s1", section: "solution", text: "Pierwsze zdanie." },
      { id: "c900.s2", section: "solution", text: "Drugie zdanie." },
      { id: "c900.s3", section: "problems", text: "Problem." },
    ];
    const sections = {
      solution: "Pierwsze zdanie. Zmienione drugie zdanie.",
      problems: "Problem.",
      targetGroup: "",
      whoCanUse: "Gminy.",
      doesItWork: "",
      authors: "",
    };
    const r = rederiveSentences("c900", prev, sections);
    expect(r.sentences.map((s) => s.id)).toEqual([
      "c900.s1",
      "c900.s4",
      "c900.s3",
      "c900.s5",
    ]);
    expect(r.kept).toBe(2);
    expect(r.added).toEqual(["c900.s4", "c900.s5"]);
    expect(r.removed).toEqual(["c900.s2"]);
  });
});
