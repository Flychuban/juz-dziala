import { describe, expect, it } from "vitest";

import { createCaseInputSchema, normalizePhone } from "./input";

const base = {
  kind: "need",
  title: "Samotny senior",
  body: "Sąsiad mieszka sam i nie wychodzi z domu.",
} as const;

describe("createCaseInputSchema", () => {
  it("fills defaults: resident, no contact, not on behalf", () => {
    const v = createCaseInputSchema.parse(base);
    expect(v.authorRole).toBe("resident");
    expect(v.contactPref).toBe("none");
    expect(v.onBehalf).toBe(false);
  });

  it("requires a real e-mail when the author chose e-mail", () => {
    const r = createCaseInputSchema.safeParse({
      ...base,
      contactPref: "email",
      contact: "nie-mail",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["contact"]);
    expect(r.error?.issues[0]?.message).toMatch(/adres e-mail/);
  });

  it("requires a phone number for SMS and callback", () => {
    expect(
      createCaseInputSchema.safeParse({ ...base, contactPref: "sms" }).success,
    ).toBe(false);
    expect(
      createCaseInputSchema.safeParse({
        ...base,
        contactPref: "phone",
        contact: "600 100 200",
      }).success,
    ).toBe(true);
  });

  it("rejects a body too short to act on, in Polish", () => {
    const r = createCaseInputSchema.safeParse({ ...base, body: "pomocy" });
    expect(r.error?.issues[0]?.message).toMatch(/za krótki/);
  });
});

describe("normalizePhone", () => {
  it("keeps digits and a leading plus", () => {
    expect(normalizePhone("+48 600-100-200")).toBe("+48600100200");
    expect(normalizePhone("600 100 200")).toBe("600100200");
  });
  it("refuses what cannot be a number", () => {
    expect(normalizePhone("12 34")).toBeNull();
  });
});
