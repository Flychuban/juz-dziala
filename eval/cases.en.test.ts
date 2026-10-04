/**
 * The English set is a translation of the frozen Polish one, nothing more:
 * same ids, kinds, expectations, planted personal data and forbidden slugs.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { redactPII } from "../src/server/domain/redact";
import { evalSetSchema, findPiiLeaks } from "./lib";

const read = (f: string) => evalSetSchema.parse(JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8")));
const pl = read("./cases.json");
const en = read("./cases.en.json");

describe("eval/cases.en.json", () => {
  it("translates every case and changes no expectation", () => {
    const expectations = (s: typeof pl) =>
      s.cases.map(({ id, kind, acceptableSlugs, primarySlug, expectAbstain, pii, forbiddenSlugs }) => ({
        id,
        kind,
        acceptableSlugs,
        primarySlug,
        expectAbstain,
        pii,
        forbiddenSlugs,
      }));
    expect(expectations(en)).toEqual(expectations(pl));
  });

  it("is English text, not the Polish one", () => {
    for (const [i, c] of en.cases.entries()) expect(c.text).not.toBe(pl.cases[i]!.text);
  });

  it("keeps the planted personal data, and English redaction removes all of it", () => {
    for (const c of en.cases.filter((x) => x.pii?.length)) {
      for (const v of c.pii!) expect(c.text).toContain(v);
      const redacted = redactPII(c.text, "en").text;
      expect(findPiiLeaks(c.pii!, [redacted])).toEqual([]);
      expect(redacted).toContain("[phone]");
    }
  });
});
