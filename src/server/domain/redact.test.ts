import { describe, expect, it } from "vitest";
import { isValidPesel, redactPII } from "./redact";

// 44051401359 is the specimen PESEL used in public documentation; its check digit is valid.
const VALID_PESEL = "44051401359";
const INVALID_PESEL = "44051401358";

const kinds = (text: string) => Object.fromEntries(redactPII(text).found.map((f) => [f.kind, f.count]));

describe("isValidPesel", () => {
  it("accepts a correct check digit", () => {
    expect(isValidPesel(VALID_PESEL)).toBe(true);
    expect(isValidPesel("02070803628")).toBe(true);
  });

  it("rejects a wrong check digit, wrong length and non-digits", () => {
    expect(isValidPesel(INVALID_PESEL)).toBe(false);
    expect(isValidPesel("4405140135")).toBe(false);
    expect(isValidPesel("440514013590")).toBe(false);
    expect(isValidPesel("4405140135a")).toBe(false);
  });
});

describe("redactPII: PESEL", () => {
  it("redacts an 11-digit number with a valid checksum", () => {
    const r = redactPII(`Mój PESEL to ${VALID_PESEL}, proszę o pomoc.`);
    expect(r.text).toBe("Mój PESEL to [PESEL], proszę o pomoc.");
    expect(r.found).toEqual([{ kind: "pesel", count: 1 }]);
  });

  it("leaves an 11-digit number with an invalid checksum alone", () => {
    const r = redactPII(`Numer ${INVALID_PESEL}`);
    expect(r.text).toBe(`Numer ${INVALID_PESEL}`);
    expect(r.found).toEqual([]);
  });

  it("does not redact 11 digits inside a longer number", () => {
    const text = `ID 9${VALID_PESEL}9`;
    expect(redactPII(text).text).toBe(text);
  });
});

describe("redactPII: phone", () => {
  it.each([
    ["600 700 800", "3-3-3 with spaces"],
    ["600-700-800", "3-3-3 with hyphens"],
    ["600700800", "contiguous"],
    ["+48 600 700 800", "+48 prefix"],
    ["+48600700800", "+48 contiguous"],
    ["0048 600 700 800", "0048 prefix"],
    ["(+48) 600 700 800", "(+48) prefix"],
    ["512 34 56 78", "mobile 3-2-2-2"],
    ["12 345 67 89", "landline 2-3-2-2"],
    ["(12) 345-67-89", "landline with area code in brackets"],
  ])("redacts %s (%s)", (phone) => {
    const r = redactPII(`Proszę dzwonić: ${phone}.`);
    expect(r.text).toBe("Proszę dzwonić: [telefon].");
    expect(kinds(`tel ${phone}`)).toEqual({ phone: 1 });
  });

  it("leaves no digit of the number behind", () => {
    const r = redactPII("tel. +48 512 345 678 wieczorem");
    expect(r.text).not.toMatch(/512|345|678/);
  });

  it("does not treat a nine-digit money amount as a phone", () => {
    expect(redactPII("budżet 100 000 000 zł").text).toBe("budżet 100 000 000 zł");
    expect(redactPII("kwota 250000000 PLN").text).toBe("kwota 250000000 PLN");
  });
});

describe("redactPII: e-mail", () => {
  it("redacts an address, including one with Polish letters", () => {
    expect(redactPII("Pisz na jan.kowalski+rops@example.com.pl!").text).toBe("Pisz na [e-mail]!");
    expect(redactPII("adres: zażółć@przykład.pl").text).toBe("adres: [e-mail]");
  });

  it("does not leave digits from the local part to be read as a phone", () => {
    const r = redactPII("kontakt: user600700800@example.com");
    expect(r.text).toBe("kontakt: [e-mail]");
    expect(r.found).toEqual([{ kind: "email", count: 1 }]);
  });
});

describe("redactPII: account number", () => {
  it("redacts an NRB with PL prefix and spaces", () => {
    const r = redactPII("Konto: PL61 1090 1014 0000 0712 1981 2874.");
    expect(r.text).toBe("Konto: [numer konta].");
    expect(r.found).toEqual([{ kind: "iban", count: 1 }]);
  });

  it("redacts 26 contiguous digits without prefix", () => {
    expect(redactPII("nr 61109010140000071219812874").text).toBe("nr [numer konta]");
  });
});

describe("redactPII: street address", () => {
  it.each([
    ["ul. Długa 15/4", "ul."],
    ["ul. Długiej 15", "inflected street"],
    ["al. Jana Pawła II 12", "aleja with Roman numeral"],
    ["ul. 3 Maja 5", "street named after a date"],
    ["os. Na Kozłówce 3a", "osiedle with letter suffix"],
    ["pl. Wolnica 1", "plac"],
    ["ulica Krakowska 7 m. 2", "full word and m."],
    ["Aleja Pokoju 44", "capitalised Aleja"],
  ])("redacts %s (%s)", (address) => {
    expect(redactPII(`Mieszkam: ${address}, Kraków.`).text).toBe("Mieszkam: [adres], Kraków.");
  });

  it("keeps the city and postal code", () => {
    expect(redactPII("ul. Długa 5, 31-147 Kraków").text).toBe("[adres], 31-147 Kraków");
  });

  it("does not redact a street name without a house number", () => {
    expect(redactPII("mieszkam przy ul. Długiej w Krakowie").text).toBe("mieszkam przy ul. Długiej w Krakowie");
  });
});

describe("redactPII: honorific + name", () => {
  it.each([
    ["Pani Kowalska", "Pani [osoba]"],
    ["Pan Nowak", "Pan [osoba]"],
    ["Panu Wiśniewskiemu", "Panu [osoba]"],
    ["Panią Zielińską", "Panią [osoba]"],
    ["Pani Anna Nowak-Wójcik", "Pani [osoba]"],
    ["u pani Ewy", "u pani [osoba]"],
  ])("replaces the name in %s", (input, expected) => {
    expect(redactPII(input).text).toBe(expected);
  });

  it("does not touch an honorific without a capitalised name", () => {
    expect(redactPII("Pani z MOPS powiedziała, że pan nie może.").text).toBe(
      "Pani z MOPS powiedziała, że pan nie może.",
    );
  });
});

describe("redactPII: false-positive guards", () => {
  it.each([
    "Mama ma 73 lata i mieszka sama od 2019 roku.",
    "Rachunek wzrósł o 350 zł, emerytura to 2 450,50 zł.",
    "Kod pocztowy 31-147 Kraków.",
    "Spotkanie 12.03.2026 o 14:30, pokój 112.",
    "Dzwoniłam na 112 i 800 70 2222.",
    "Syn ma 16 lat, córka 9.",
    "W 2024 r. było 1 200 osób w kryzysie.",
  ])("leaves %s unchanged", (text) => {
    const r = redactPII(text);
    expect(r.text).toBe(text);
    expect(r.found).toEqual([]);
  });
});

describe("redactPII: mixed", () => {
  it("redacts every kind in one text and counts them", () => {
    const text =
      `Nazywam się Pani Testowa, PESEL ${VALID_PESEL}, tel. 512 345 678, ` +
      "mail jan.testowy@example.com, mieszkam na ul. Długiej 15/4, konto PL61 1090 1014 0000 0712 1981 2874.";
    const r = redactPII(text);
    expect(r.text).toBe(
      "Nazywam się Pani [osoba], PESEL [PESEL], tel. [telefon], mail [e-mail], mieszkam na [adres], konto [numer konta].",
    );
    expect(kinds(text)).toEqual({ email: 1, iban: 1, pesel: 1, phone: 1, address: 1, name: 1 });
    expect(r.text).not.toMatch(/[0-9]/);
  });

  it("is a no-op on an empty string", () => {
    expect(redactPII("")).toEqual({ text: "", found: [] });
  });
});
