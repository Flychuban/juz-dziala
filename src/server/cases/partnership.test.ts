import { describe, expect, it } from "vitest";

import {
  PARTNER_AUTHOR_ROLE,
  partnerInputSchema,
  partnershipCase,
  shortLine,
} from "./partnership";

const PL = {
  prefix: "Partnerstwo",
  intro: "Szukam partnera — prośba o pośrednictwo ROPS.",
  who: "Kto pisze",
  typeLabel: "Szkoła",
  org: "Prośba o kontakt z",
  offer: "Co oferujemy",
  need: "Czego szukamy",
};

describe("partnershipCase", () => {
  it("titles a request for a named organisation with that name", () => {
    const r = partnershipCase(
      { offer: "Salę i wolontariuszy.", need: "Wspólnych zajęć dla seniorów.", org: "Fundacja Przykład" },
      PL,
    );
    expect(r.title).toBe("Partnerstwo: Fundacja Przykład");
    expect(r.body).toContain("Prośba o kontakt z: Fundacja Przykład");
    expect(r.body).toContain("Co oferujemy:\nSalę i wolontariuszy.");
    expect(r.body).toContain("Czego szukamy:\nWspólnych zajęć dla seniorów.");
  });

  it("otherwise titles it with the first sentence of what is sought", () => {
    const r = partnershipCase(
      { offer: "Lokal", need: "Szukamy szkoły do projektu. Najlepiej w powiecie." },
      PL,
    );
    expect(r.title).toBe("Partnerstwo: Szukamy szkoły do projektu");
    expect(r.body).not.toContain("Prośba o kontakt z");
  });
});

describe("shortLine", () => {
  it("cuts long text at a word", () => {
    const s = shortLine("a".repeat(10) + " " + "b".repeat(100), 40);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(40);
  });
});

describe("partnerInputSchema", () => {
  it("accepts a minimal request and maps the institution to an author role", () => {
    const v = partnerInputSchema.parse({ partnerType: "school", offer: "sala", need: "partner" });
    expect(v.contactPref).toBe("none");
    expect(PARTNER_AUTHOR_ROLE[v.partnerType]).toBe("other");
    expect(PARTNER_AUTHOR_ROLE.gmina).toBe("jst");
  });

  it("refuses an empty offer and a gmina code from outside Małopolska", () => {
    expect(partnerInputSchema.safeParse({ partnerType: "ngo", offer: " ", need: "partner" }).success).toBe(false);
    expect(
      partnerInputSchema.safeParse({ partnerType: "ngo", offer: "sala", need: "partner", gminaTeryt: "1465011" }).success,
    ).toBe(false);
  });
});
