import { describe, expect, it } from "vitest";

import { easyTextProblem, tidyEasyText } from "./easy-text-check";

const card =
  "Bus raz w tygodniu dojeżdża do 12 wsi. Prowadzi zajęcia dla osób 60+. Koszt 1,5 tys. zł miesięcznie.";

describe("easyTextProblem", () => {
  it("accepts a short text that only repeats numbers from the card", () => {
    expect(
      easyTextProblem(
        "To jest bus dla seniorów.\nPrzyjeżdża do 12 wsi.\nZajęcia są dla osób 60+.",
        card,
      ),
    ).toBeNull();
  });
  it("rejects a number that the card does not contain", () => {
    expect(
      easyTextProblem(
        "To jest bus dla seniorów.\nPrzyjeżdża do 15 wsi w powiecie.",
        card,
      ),
    ).toMatch(/15/);
  });
  it("rejects texts that are too short or too long", () => {
    expect(easyTextProblem("Bus.", card)).toBe("za krótki");
    expect(easyTextProblem(Array(200).fill("słowo").join(" "), card)).toBe(
      "za długi",
    );
  });
});

describe("tidyEasyText", () => {
  it("keeps one sentence per line without list markers", () => {
    expect(tidyEasyText("- Pierwsze zdanie.\n\n2) Drugie zdanie.\r\n")).toBe(
      "Pierwsze zdanie.\nDrugie zdanie.",
    );
  });
});
