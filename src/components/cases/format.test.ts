import { describe, expect, it } from "vitest";

import { ageLabel, looseCaseCode, plural } from "./format";

const SPRAWA: [string, string, string] = ["sprawa", "sprawy", "spraw"];

describe("plural", () => {
  it("follows Polish plural rules", () => {
    expect(
      [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 112].map((n) => plural(n, SPRAWA)),
    ).toEqual([
      "sprawa",
      "sprawy",
      "sprawy",
      "spraw",
      "spraw",
      "spraw",
      "spraw",
      "spraw",
      "sprawy",
      "spraw",
      "spraw",
    ]);
  });
});

describe("looseCaseCode", () => {
  it("accepts what people type", () => {
    expect(looseCaseCode("jd 7k3q x9mp")).toBe("JD-7K3Q-X9MP");
    expect(looseCaseCode("7K3QX9MP")).toBe("JD-7K3Q-X9MP");
    expect(looseCaseCode("JD-7K3Q-X9M")).toBeNull();
  });
});

describe("ageLabel", () => {
  it("speaks in minutes, hours and days", () => {
    const now = Date.UTC(2026, 9, 3, 12);
    expect(ageLabel(new Date(now - 30_000), now)).toBe("przed chwilą");
    expect(ageLabel(new Date(now - 5 * 60_000), now)).toBe("5 min temu");
    expect(ageLabel(new Date(now - 3 * 3_600_000), now)).toBe("3 godz. temu");
    expect(ageLabel(new Date(now - 26 * 3_600_000), now)).toBe("1 dzień temu");
    expect(ageLabel(new Date(now - 72 * 3_600_000), now)).toBe("3 dni temu");
  });
});
