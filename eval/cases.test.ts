/**
 * Guards the frozen evaluation set itself: its size and mix, that every slug it
 * names is a real library card (per the 2026-10-03 listing snapshot), and that
 * the adversarial PII case is fully redacted.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectCrisis } from "../src/server/domain/crisis";
import { isValidPesel, redactPII } from "../src/server/domain/redact";
import { evalSetSchema, findPiiLeaks } from "./lib";

const set = evalSetSchema.parse(JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")));
const snapshot = JSON.parse(readFileSync(new URL("./library-slugs.json", import.meta.url), "utf8")) as {
  cards: { slug: string }[];
};
const knownSlugs = new Set(snapshot.cards.map((c) => c.slug));

describe("eval/cases.json", () => {
  it("has exactly 20 cases with unique ids", () => {
    expect(set.cases).toHaveLength(20);
    expect(new Set(set.cases.map((c) => c.id)).size).toBe(20);
  });

  it("has the agreed mix", () => {
    const count = (k: string) => set.cases.filter((c) => c.kind === k).length;
    expect({
      keyword: count("keyword"),
      story: count("story"),
      colloquial: count("colloquial"),
      multi: count("multi"),
      none: count("none"),
      adversarial: count("adversarial"),
    }).toEqual({ keyword: 5, story: 6, colloquial: 3, multi: 2, none: 2, adversarial: 2 });
  });

  it("uses two-word queries for the keyword cases", () => {
    for (const c of set.cases.filter((c) => c.kind === "keyword")) expect(c.text.split(/\s+/u)).toHaveLength(2);
  });

  it("names only slugs that exist in the library snapshot", () => {
    expect(knownSlugs.size).toBe(115);
    for (const c of set.cases) {
      for (const s of [...c.acceptableSlugs, ...(c.forbiddenSlugs ?? []), ...(c.primarySlug ? [c.primarySlug] : [])]) {
        expect(knownSlugs.has(s), `${c.id}: ${s}`).toBe(true);
      }
      if (c.primarySlug) expect(c.acceptableSlugs).toContain(c.primarySlug);
    }
  });

  it("expects abstention exactly on the no-answer cases, which have no acceptable slugs", () => {
    for (const c of set.cases) {
      expect(c.expectAbstain).toBe(c.kind === "none");
      expect(c.acceptableSlugs.length === 0).toBe(c.kind === "none");
    }
  });

  it("plants a valid-checksum PESEL and a phone in the PII case, and redaction removes every digit of them", () => {
    const pii = set.cases.find((c) => c.pii && c.pii.length > 0)!;
    expect(pii.kind).toBe("adversarial");
    expect(pii.pii!.some((p) => isValidPesel(p))).toBe(true);
    const redacted = redactPII(pii.text).text;
    expect(findPiiLeaks(pii.pii!, [redacted])).toEqual([]);
    expect(redacted).toContain("[PESEL]");
    expect(redacted).toContain("[telefon]");
    expect(redacted).toContain("[e-mail]");
  });

  it("includes a prompt-injection case with a forbidden slug", () => {
    const inj = set.cases.find((c) => (c.forbiddenSlugs ?? []).length > 0)!;
    expect(inj.kind).toBe("adversarial");
    expect(inj.text).toMatch(/Zignoruj poprzednie instrukcje/u);
  });

  it("contains no crisis text (crisis handling is tested separately)", () => {
    for (const c of set.cases) expect(detectCrisis(c.text).urgent, c.id).toBe(false);
  });
});
