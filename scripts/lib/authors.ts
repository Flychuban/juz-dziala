/**
 * "Autorzy" sections: keep organisations, remove private individuals (sponsor rule: no real
 * personal data). Pure functions, shared by ingest-library.ts and build-network.ts.
 */

export const PRIVATE_PERSONS = "(osoby prywatne — dane w źródle)";
export const AND_PRIVATE_PERSONS = "(oraz osoby prywatne — dane w źródle)";

/** Stems that mark an organisation, matched at a word start, case-insensitively. */
const ORG_MARKERS = [
  "fundacj", "fudacj" /* source typo: „Fudacja "Aprobata"" */, "stowarzysz", "uniwersytet", "uczelni", "akademi",
  "politechnik", "szkoł", "szkol", "instytut", "wydział", "katedr", "spółk", "firma", "przedsiębiorstw",
  "ośrod", "centrum", "mops", "gops", "ops", "pcpr", "cus", "rops", "urząd", "urzęd", "gmin", "powiat", "miasto",
  "miast", "województw", "związek", "związk", "klub", "koło", "spółdziel", "towarzystw", "federacj", "parafi",
  "caritas", "dom pomocy", "dps", "warsztat", "zakład", "fundusz", "agencj", "biuro", "kancelari", "laboratori",
  "lgd", "kgw", "grupa nieformalna", "grupa inicjatywna", "inkubator", "przedszkol", "żłob", "szpital", "spzoz",
  "hospicj", "poradni", "bibliotek", "muzeum", "teatr", "instytucj", "organizacj", "kooperatyw", "pracowni",
  "sołectw", "wspólnot", "diecezj", "foundation", "association", "university", "ltd", "gmbh",
];
const ORG_RES = ORG_MARKERS.map((m) => new RegExp(`(^|[^\\p{L}])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu"));
const COMPANY_FORM = /\b(sp\.?\s*z\s*o\.?\s*o\.?|s\.\s?c\.|s\.\s?a\.|sp\.\s*j\.|sp\.\s*k\.)/i;

export function hasOrgMarker(item: string): boolean {
  return ORG_RES.some((re) => re.test(item)) || COMPANY_FORM.test(item) || /[„"”«»]/.test(item);
}

/**
 * Common first names in the nominative (Polish, plus the Ukrainian ones that occur in the
 * library). Used only to find a person's name embedded in an organisation's name — e.g. a sole
 * trader's business name „Instytut HR Ewa X" — so it can be removed. A patron in the genitive
 * („im. Jana Matejki") is not in the nominative and is not touched.
 */
const FIRST_NAMES = new Set(
  (
    "Ada Adam Adrian Adrianna Agata Agnieszka Alan Albert Aleksander Aleksandra Alicja Amelia Andrzej Aneta Angelika Anna Antoni Antonina Arkadiusz Artur " +
    "Barbara Bartłomiej Bartosz Beata Bogdan Bogumiła Bogusław Bożena Cezary Czesław Czesława Damian Daniel Daniela Danuta Dariusz Dawid Dominik Dominika Dorota " +
    "Edward Edyta Elżbieta Emil Emilia Ewa Ewelina Filip Franciszek Gabriel Gabriela Genowefa Grażyna Grzegorz Halina Hanna Helena Henryk Hubert Ilona Irena Iwona Iza Izabela " +
    "Jacek Jadwiga Jakub Jan Janina Janusz Jarosław Jerzy Joanna Jolanta Józef Julia Julian Justyna Kacper Kamil Kamila Karol Karolina Katarzyna Kazimierz Kinga Klaudia Konrad Krystian Krystyna Krzysztof " +
    "Lech Leon Leszek Lucyna Łucja Łukasz Maciej Magdalena Maja Małgorzata Marcin Marek Maria Mariola Marian Marianna Mariusz Marta Martyna Marzena Mateusz Michał Michalina Mieczysław Mikołaj Milena Mirosław Mirosława Monika " +
    "Natalia Nikola Norbert Oliwia Patrycja Patryk Paula Paulina Paweł Piotr Przemysław Radosław Rafał Renata Robert Roman Ryszard Sabina Sebastian Stanisław Stanisława Stefan Sylwester Sylwia Szymon " +
    "Tadeusz Teresa Tomasz Urszula Wanda Weronika Wiesław Wiesława Wiktor Wiktoria Wioletta Witold Władysław Włodzimierz Wojciech Zbigniew Zdzisław Zofia Zuzanna Zygmunt " +
    "Ivan Iwan Volodymyr Wołodymyr Olena Ołena Oksana Ołeksandr Oleksandr Olha Tetiana Tetyana Yulia Iryna Natalija Serhii Andrii Dmytro Mykola Taras Viktoria Yaroslav"
  ).split(/\s+/),
);

const TITLE = String.raw`(?:(?:prof|dr|hab|mgr|inż|arch|lek|med|n\.\s?med)\.?\s+)`;
const SURNAME = String.raw`\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?`;
const PERSON = new RegExp(`^${TITLE}*${SURNAME}(?:\\s+${SURNAME}){1,2}$`, "u");

/** "Jan Kowalski", "dr hab. inż. Anna Nowak-Kowalska", "Ivan X, Volodymyr X", "A B i C D". */
export function isPersonList(item: string): boolean {
  const parts = item
    .split(/\s*,\s*|\s+(?:i|oraz)\s+/u)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => PERSON.test(p));
}

/** Remove "Firstname Lastname" sequences (known first name, nominative) from an organisation's name. */
export function stripEmbeddedPersons(item: string): { text: string; removed: number } {
  let removed = 0;
  const re = new RegExp(`(^|[\\s,–—-]+)${TITLE}*(\\p{Lu}\\p{Ll}+)\\s+(${SURNAME})(?=$|[\\s,;:)–—-])`, "gu");
  const text = item.replace(re, (whole, lead: string, first: string, _last: string, offset: number) => {
    if (!FIRST_NAMES.has(first)) return whole;
    const before = item.slice(0, offset + lead.length);
    if (/(^|\s)(im\.|imienia|św\.)\s*$/u.test(before)) return whole; // patron, not an author
    removed++;
    return "";
  });
  return { text: text.replace(/\s{2,}/g, " ").replace(/[\s,–—-]+$/u, "").trim(), removed };
}

export type AuthorsResult = { text: string; organisations: string[]; droppedPersons: number; ambiguous: string[] };

const BULLET = /^\s*(?:[-–—•·*▪►■●◦]|\d{1,2}[.)](?=\s))\s*/;

/**
 * Lines that are organisations are kept (with any embedded personal name removed); lines that
 * are people are dropped; a line that is neither is dropped too (privacy first) and reported as
 * ambiguous so a person can look at it. An empty section stays empty.
 */
export function anonymiseAuthors(raw: string): AuthorsResult {
  const items = raw
    .split(/\n+/)
    .map((l) => l.replace(BULLET, "").trim())
    .filter(Boolean);
  if (!items.length) return { text: "", organisations: [], droppedPersons: 0, ambiguous: [] };
  const organisations: string[] = [];
  const ambiguous: string[] = [];
  let droppedPersons = 0;
  for (const item of items) {
    if (hasOrgMarker(item)) {
      const { text, removed } = stripEmbeddedPersons(item);
      droppedPersons += removed;
      const clean = text.replace(/[\s;,:]+$/u, "");
      if (clean) organisations.push(clean);
    } else {
      droppedPersons++;
      if (!isPersonList(item)) ambiguous.push(item);
    }
  }
  const lines = [...organisations];
  if (!organisations.length) lines.push(PRIVATE_PERSONS);
  else if (droppedPersons) lines.push(AND_PRIVATE_PERSONS);
  return { text: lines.join("\n"), organisations, droppedPersons, ambiguous };
}
