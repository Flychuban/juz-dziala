import { describe, expect, it } from "vitest";
import {
  CASE_CODE_ALPHABET,
  generateAccessToken,
  generateCaseCode,
  hashToken,
  isCaseCode,
  maskContact,
  normalizeCaseCode,
} from "./case-code";

describe("CASE_CODE_ALPHABET", () => {
  it("has no ambiguous characters", () => {
    for (const c of "01ILOU") expect(CASE_CODE_ALPHABET).not.toContain(c);
    expect(CASE_CODE_ALPHABET).toHaveLength(30);
  });
});

describe("generateCaseCode", () => {
  it("produces JD-XXXX-XXXX from the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCaseCode();
      expect(code).toMatch(/^JD-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/);
      expect(isCaseCode(code)).toBe(true);
    }
  });

  it("does not repeat in practice", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateCaseCode));
    expect(codes.size).toBe(1000);
  });
});

describe("isCaseCode", () => {
  it("accepts only the canonical form", () => {
    expect(isCaseCode("JD-ABCD-2345")).toBe(true);
    expect(isCaseCode("jd-abcd-2345")).toBe(false);
    expect(isCaseCode("JD-ABCD-234O")).toBe(false);
  });
});

describe("normalizeCaseCode", () => {
  it.each([
    ["JD-ABCD-2345", "JD-ABCD-2345"],
    ["jd-abcd-2345", "JD-ABCD-2345"],
    [" jd abcd 2345 ", "JD-ABCD-2345"],
    ["JDABCD2345", "JD-ABCD-2345"],
    ["abcd-2345", "JD-ABCD-2345"],
    ["abcd2345", "JD-ABCD-2345"],
    ["JD–ABCD–2345", "JD-ABCD-2345"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeCaseCode(input)).toBe(expected);
  });

  it.each(["", "JD-ABCD", "JD-ABCD-23456", "JD-ABCD-234O", "JD-ABCD-2341", "JD-ABCL-2345", "XY-ABCD-2345", "JD-ABCD-23!5"])(
    "rejects %s",
    (input) => {
      expect(normalizeCaseCode(input)).toBeNull();
    },
  );

  it("round-trips generated codes", () => {
    const code = generateCaseCode();
    expect(normalizeCaseCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
  });
});

describe("generateAccessToken", () => {
  it("is 32 random bytes in base64url", () => {
    const t = generateAccessToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(generateAccessToken()).not.toBe(t);
  });
});

describe("hashToken", () => {
  it("is sha256 hex", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashToken(generateAccessToken())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("maskContact", () => {
  it.each([
    ["jan.kowalski@gmail.com", "j***@g***.com"],
    ["Anna@o2.pl", "A***@o***.pl"],
    ["ktos@poczta.onet.pl", "k***@p***.pl"],
    ["+48 600 700 789", "+48 *** *** 789"],
    ["+48600700789", "+48 *** *** 789"],
    ["0048 600 700 789", "+48 *** *** 789"],
    ["600-700-789", "*** *** 789"],
    ["12 345 67 89", "*** *** 789"],
  ])("masks %s", (input, expected) => {
    expect(maskContact(input)).toBe(expected);
  });

  it("never returns the full contact", () => {
    for (const c of ["jan.kowalski@gmail.com", "+48 600 700 789", "Jan Kowalski"]) {
      expect(maskContact(c)).not.toBe(c);
    }
  });

  it("masks something that is neither an e-mail nor a phone", () => {
    expect(maskContact("Jan Kowalski")).toBe("J***");
    expect(maskContact("")).toBe("");
  });
});
