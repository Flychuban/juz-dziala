import { describe, expect, it } from "vitest";
import {
  fold,
  isStopword,
  normalize,
  stem,
  stripPolishDiacritics,
  tokenize,
  tokenizeWithOffsets,
} from "./polish";

describe("normalize", () => {
  it("lowercases, collapses whitespace and trims", () => {
    expect(normalize("  Mama   MA\t73\nlata ")).toBe("mama ma 73 lata");
  });

  it("composes decomposed Polish letters (NFC)", () => {
    const decomposed = "Żółw"; // Ż ó ł typed as base + combining mark
    expect(normalize(decomposed)).toBe("żółw");
    expect(normalize(decomposed).length).toBe(4);
  });

  it("unifies quotes and dashes", () => {
    expect(normalize("„Zaraz Jadę” – ‘test’ — x")).toBe('"zaraz jadę" - \'test\' - x');
  });

  it("treats non-breaking spaces as spaces and drops soft hyphens", () => {
    expect(normalize("ul. Długa­")).toBe("ul. długa");
  });
});

describe("fold", () => {
  it("strips all nine Polish diacritics", () => {
    expect(fold("Zażółć gęślą jaźń")).toBe("zazolc gesla jazn");
    expect(fold("ĄĆĘŁŃÓŚŹŻ")).toBe("acelnoszz");
  });

  it("does not decompose Cyrillic letters", () => {
    expect(fold("Київ й")).toBe("київ й");
  });
});

describe("stripPolishDiacritics", () => {
  it("maps one character to one character and keeps case", () => {
    const s = "Łódź i Żywiec";
    const out = stripPolishDiacritics(s);
    expect(out).toBe("Lodz i Zywiec");
    expect(out.length).toBe(s.length);
  });
});

describe("tokenize", () => {
  it("splits Polish words without breaking on diacritics", () => {
    expect(tokenize("Samotność, żółć i źdźbło!")).toEqual(["samotność", "żółć", "i", "źdźbło"]);
  });

  it("keeps digits as words and splits on hyphens and slashes", () => {
    expect(tokenize("po 70-tce g/Głuchych PL-PJM")).toEqual(["po", "70", "tce", "g", "głuchych", "pl", "pjm"]);
  });

  it("returns an empty list for punctuation only", () => {
    expect(tokenize(" ,.;!? ")).toEqual([]);
  });
});

describe("tokenizeWithOffsets", () => {
  it("returns original spelling with folded form and offsets", () => {
    const tokens = tokenizeWithOffsets("Mama, Żaneta");
    expect(tokens).toEqual([
      { text: "Mama", norm: "mama", folded: "mama", start: 0, end: 4 },
      { text: "Żaneta", norm: "żaneta", folded: "zaneta", start: 6, end: 12 },
    ]);
  });
});

describe("isStopword", () => {
  it("recognises stopwords regardless of case and diacritics", () => {
    expect(isStopword("się")).toBe(true);
    expect(isStopword("SIE")).toBe(true);
    expect(isStopword("że")).toBe(true);
  });

  it("does not drop words that carry meaning", () => {
    expect(isStopword("sama")).toBe(false);
    expect(isStopword("sam")).toBe(false);
    expect(isStopword("senior")).toBe(false);
    expect(isStopword("nikt")).toBe(false);
  });
});

describe("stem", () => {
  it("gives samotność / samotna / samotnie one stem", () => {
    const s = stem("samotność");
    expect(stem("samotna")).toBe(s);
    expect(stem("samotnie")).toBe(s);
    expect(stem("samotny")).toBe(s);
    expect(stem("samotnych")).toBe(s);
  });

  it("gives seniorzy / seniorów / senior one stem", () => {
    const s = stem("senior");
    expect(stem("seniorzy")).toBe(s);
    expect(stem("seniorów")).toBe(s);
    expect(stem("seniorom")).toBe(s);
    expect(stem("Seniorami")).toBe(s);
  });

  it("is diacritic-insensitive", () => {
    expect(stem("niepełnosprawność")).toBe(stem("niepelnosprawnosc"));
    expect(stem("wózek")).toBe(stem("wozek"));
  });

  it("joins other common families", () => {
    expect(stem("praca")).toBe(stem("pracy"));
    expect(stem("pracę")).toBe(stem("pracą"));
    expect(stem("wózek")).toBe(stem("wózkiem"));
    expect(stem("dzieci")).toBe(stem("dzieciom"));
    expect(stem("bezdomność")).toBe(stem("bezdomnych"));
  });

  it("leaves short words alone and caps long ones", () => {
    expect(stem("dom")).toBe("dom");
    expect(stem("leki")).toBe("leki");
    expect(stem("70")).toBe("70");
    expect(stem("niepełnosprawnością").length).toBeLessThanOrEqual(7);
    expect(stem("niepełnosprawnością")).toBe("niepeln");
  });

  it("never strips below four characters", () => {
    expect(stem("osoby")).toBe("osob");
    expect(stem("leków")).toBe("lekow");
  });

  it("keeps przemoc apart from przemoknięta", () => {
    expect(stem("przemoc")).toBe(stem("przemocy"));
    expect(stem("przemoc")).not.toBe(stem("przemoknięta"));
  });

  it("is deterministic", () => {
    expect(stem("Samotność")).toBe(stem("Samotność"));
  });
});
