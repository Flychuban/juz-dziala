import { describe, expect, it } from "vitest";

import { CASE_KINDS, CASE_STATUSES } from "~/lib/domain";
import { isCaseCode } from "~/server/domain/case-code";
import { detectCrisis } from "~/server/domain/crisis";
import { redactPII } from "~/server/domain/redact";
import { looksLikeGibberish } from "./gibberish";
import {
  DEMO_EXPERT,
  SAMPLE_CASE_PREFIX,
  SAMPLE_CASES,
} from "./sample-cases-data";

const texts = (c: (typeof SAMPLE_CASES)[number]) => [
  c.title,
  c.body,
  ...c.thread.map((m) => m.body),
];

describe("sample cases", () => {
  it("have valid, unique codes under the sample prefix", () => {
    const codes = SAMPLE_CASES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(isCaseCode(code), code).toBe(true);
      expect(code.startsWith(SAMPLE_CASE_PREFIX)).toBe(true);
    }
  });

  it("cover every kind and every status", () => {
    expect(new Set(SAMPLE_CASES.map((c) => c.kind))).toEqual(
      new Set(CASE_KINDS),
    );
    expect(new Set(SAMPLE_CASES.map((c) => c.status))).toEqual(
      new Set(CASE_STATUSES),
    );
  });

  it("have two open cases waiting over 48 h and two for the demo expert", () => {
    const open = new Set(["new", "triaged", "in_progress"]);
    const waiting = SAMPLE_CASES.filter((c) => {
      const last = Math.min(c.hoursAgo, ...c.thread.map((m) => m.hoursAgo));
      return open.has(c.status) && last > 48;
    });
    expect(waiting).toHaveLength(2);
    expect(SAMPLE_CASES.filter((c) => c.assigneeId === DEMO_EXPERT)).toHaveLength(2);
    expect(SAMPLE_CASES.filter((c) => c.locale === "en").length).toBeGreaterThanOrEqual(1);
  });

  it("are never removed by the [test] cleanup", () => {
    expect(SAMPLE_CASES.filter((c) => c.title.startsWith("[test]"))).toEqual([]);
  });

  it("contain no crisis signals, no noise and no personal data", () => {
    for (const c of SAMPLE_CASES) {
      for (const t of texts(c)) {
        expect(detectCrisis(t).urgent, t).toBe(false);
        expect(redactPII(t).text, t).toBe(t);
      }
      expect(looksLikeGibberish(c.body), c.body).toBe(false);
    }
  });

  it("keep each thread in time order, after the case was opened", () => {
    for (const c of SAMPLE_CASES) {
      const hours = c.thread.map((m) => m.hoursAgo);
      expect(hours.every((h) => h < c.hoursAgo), c.code).toBe(true);
      expect([...hours].sort((a, b) => b - a), c.code).toEqual(hours);
    }
  });
});
