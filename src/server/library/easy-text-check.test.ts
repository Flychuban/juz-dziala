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

describe("easyTextProblem in English", () => {
  const plCard =
    "Bus dojeżdża do 12 wsi. Koszt 1 500 zł miesięcznie, czyli 1,5 tys. zł.";
  it("accepts English thousands and decimals that the Polish card states", () => {
    expect(
      easyTextProblem(
        "This is a bus for older people.\nIt goes to 12 villages.\nIt costs 1,500 zloty a month.\nThat is 1.5 thousand.",
        plCard,
        "en",
      ),
    ).toBeNull();
  });
  it("still rejects a number the card does not contain", () => {
    expect(
      easyTextProblem(
        "This is a bus for older people.\nIt goes to 20 villages every week.",
        plCard,
        "en",
      ),
    ).toMatch(/20/);
  });
  it("applies the same length limits", () => {
    expect(easyTextProblem("A bus.", plCard, "en")).toBe("za krótki");
    expect(
      easyTextProblem(Array(200).fill("word").join(" "), plCard, "en"),
    ).toBe("za długi");
  });
});
