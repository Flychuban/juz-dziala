import { describe, expect, it } from "vitest";

import { FIXTURE_CARDS } from "~/server/domain/__fixtures__/cards";
import { buildCompactIndex, buildMatchUserMessage, formatCardForPrompt, MATCH_SYSTEM_PROMPT } from "./match";

describe("MATCH_SYSTEM_PROMPT", () => {
  it("states the grounding, citation, abstain and data-not-instructions rules", () => {
    expect(MATCH_SYSTEM_PROMPT).toContain("<karty>");
    expect(MATCH_SYSTEM_PROMPT).toContain("evidenceSentenceIds");
    expect(MATCH_SYSTEM_PROMPT).toContain("abstain");
    expect(MATCH_SYSTEM_PROMPT).toContain("<dane>");
    expect(MATCH_SYSTEM_PROMPT).toContain("Pasuje, bo");
    expect(MATCH_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/u); // no dates: the block must stay cacheable
  });
});

describe("buildCompactIndex", () => {
  it("lists every card once, ordered by id, whatever the input order", () => {
    const a = buildCompactIndex(FIXTURE_CARDS);
    const b = buildCompactIndex([...FIXTURE_CARDS].reverse());
    expect(a).toBe(b);
    const lines = a.split("\n").slice(1);
    expect(lines).toHaveLength(FIXTURE_CARDS.length);
    expect(lines[0]).toMatch(/^c001 \| Mobilne wsparcie seniorów \| obszary: seniors \| słowa: - \| /u);
    expect(a).toContain(`Spis wszystkich ${FIXTURE_CARDS.length} kart`);
  });
});

describe("formatCardForPrompt", () => {
  it("prints every sentence with its id under its section label", () => {
    const text = formatCardForPrompt(FIXTURE_CARDS[0]!);
    expect(text.startsWith('<karta id="c001" tytul="Mobilne wsparcie seniorów" obszary="seniors">')).toBe(true);
    expect(text).toContain("Jakich problemów dotyczy innowacja?");
    expect(text).toContain("[c001.s3] Osoby starsze czują się osamotnione i odtrącone.");
    expect(text.endsWith("</karta>")).toBe(true);
    expect(text).not.toContain("Autorzy"); // empty sections are left out
  });
});

describe("buildMatchUserMessage", () => {
  it("wraps the resident's text with the given wrapper and appends the candidate cards", () => {
    const msg = buildMatchUserMessage("Mama mieszka sama", FIXTURE_CARDS.slice(0, 2), (label, t) => `<dane etykieta="${label}">${t}</dane>`);
    expect(msg.startsWith('<dane etykieta="opis problemu">Mama mieszka sama</dane>')).toBe(true);
    expect(msg).toContain('<karta id="c001"');
    expect(msg).toContain('<karta id="c002"');
    expect(msg).not.toContain('<karta id="c003"');
  });
});
