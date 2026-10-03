import { describe, expect, it } from "vitest";

import { htmlToText, quoteFound } from "./document-text";

describe("quoteFound", () => {
  const source =
    "Innowacja „Agencja Pracy” pozwala osobom   w kryzysie podjąć pracę bez umowy.";
  it("finds a quote regardless of case, diacritics, quote marks and spacing", () => {
    expect(
      quoteFound(
        "agencja pracy pozwala osobom w kryzysie podjac prace",
        source,
      ),
    ).toBe(true);
  });
  it("rejects text that is not in the source, and very short quotes", () => {
    expect(
      quoteFound("pozwala osobom w kryzysie dostać mieszkanie", source),
    ).toBe(false);
    expect(quoteFound("pracę", source)).toBe(false);
  });
});

describe("htmlToText", () => {
  it("drops scripts and navigation and keeps paragraphs", () => {
    const html =
      "<nav>Menu</nav><script>alert(1)</script><h1>Tytuł</h1><p>Pierwszy&nbsp;akapit.</p><p>Drugi &amp; trzeci.</p>";
    expect(htmlToText(html)).toBe("Tytuł\nPierwszy akapit.\nDrugi & trzeci.");
  });
});
