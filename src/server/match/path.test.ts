import { describe, expect, it } from "vitest";

import { FIXTURE_CARDS } from "~/server/domain/__fixtures__/cards";
import {
  authorsName,
  buildPath,
  pickFunding,
  pickGeneralFunding,
  pickListedFunding,
  pickMentor,
  pickRunBy,
  type CallRow,
  type OrgRow,
  type PersonRow,
} from "./path";

const seniors = FIXTURE_CARDS[0]!; // c001, areas: seniors
const migrants = FIXTURE_CARDS[6]!; // c007, areas: migrants

const CALLS: CallRow[] = [
  { id: "iws-2-0", name: "Nabór … „Inkubator Włączenia Społecznego 2.0”", program: "FERS", status: "closed", windowFrom: "2024-11-13", windowTo: "2024-12-13", sourceUrl: "https://example.org/iws" },
  { id: "usluga-wrazliwa-1", name: "Nabór UW I", program: "FEM", status: "closed", windowFrom: "2025-12-22", windowTo: "2026-02-20", sourceUrl: "https://example.org/uw1" },
  { id: "usluga-wrazliwa-2", name: "Nabór UW II", program: "FEM", status: "closed", windowFrom: "2026-05-27", windowTo: "2026-06-30", sourceUrl: "https://example.org/uw2" },
  { id: "demo-iws", name: "Nabór przykładowy (demo)", program: "FERS", status: "demo", windowFrom: "2026-10-03", windowTo: "2026-10-31", sourceUrl: null },
  { id: "mentores-mentorzy", name: "mentorES", program: null, status: "open", windowFrom: null, windowTo: null, sourceUrl: null },
];
const LISTED = new Map([
  ["usluga-wrazliwa-1", new Set(["c001"])],
  ["usluga-wrazliwa-2", new Set(["c001", "c005"])],
]);

describe("pickFunding", () => {
  it("names Usługa Wrażliwa when its call lists the card, the newest call first", () => {
    expect(pickFunding(seniors, CALLS, LISTED)).toMatchObject({ id: "usluga-wrazliwa-2", reason: "listed" });
  });

  it("otherwise offers only an open or demo IWS call — never a closed one, never mentorES", () => {
    expect(pickFunding(migrants, CALLS, LISTED)).toMatchObject({ id: "demo-iws", reason: "general", status: "demo" });
    expect(pickFunding(migrants, CALLS.filter((c) => c.id !== "demo-iws"), LISTED)).toBeNull();
    expect(pickFunding(migrants, CALLS.filter((c) => c.id.startsWith("mentores")), LISTED)).toBeNull();
  });

  it("keeps a closed Usługa Wrażliwa call when it lists the card", () => {
    expect(pickFunding(seniors, CALLS.filter((c) => c.id !== "demo-iws"), LISTED)).toMatchObject({
      id: "usluga-wrazliwa-2",
      status: "closed",
      reason: "listed",
    });
  });
});

const ORGS: OrgRow[] = [
  { name: "Stowarzyszenie Klucz", type: "stowarzyszenie", innovationIds: ["c001"], isSample: false, sourceUrl: "https://example.org/c001" },
];
const PEOPLE: PersonRow[] = [
  { id: "p1", displayName: "Piotr Wróbel", role: "expert", title: "Ekspert — cudzoziemcy", orgName: null, areas: ["migrants", "health"], isSample: true },
  { id: "p2", displayName: "Zespół", role: "rops", title: null, orgName: null, areas: ["migrants"], isSample: true },
];

describe("pickGeneralFunding / pickListedFunding", () => {
  it("lists a card's own programme only when the call names it; the general call is separate", () => {
    expect(pickListedFunding(seniors, CALLS, LISTED)).toMatchObject({ id: "usluga-wrazliwa-2", reason: "listed" });
    expect(pickListedFunding(migrants, CALLS, LISTED)).toBeNull();
    expect(pickGeneralFunding(CALLS)).toMatchObject({ id: "demo-iws", reason: "general" });
    expect(pickGeneralFunding(CALLS.filter((c) => c.id !== "demo-iws"))).toBeNull();
  });

  it("carries the English call name when there is one", () => {
    const withEn = CALLS.map((c) => (c.id === "demo-iws" ? { ...c, nameEn: "Sample call (demo)" } : c));
    expect(pickGeneralFunding(withEn)?.nameEn).toBe("Sample call (demo)");
    expect(pickGeneralFunding(CALLS)?.nameEn).toBeNull();
  });
});

describe("pickRunBy", () => {
  it("prefers the organisation behind the card, with its type and place when known", () => {
    expect(pickRunBy(seniors, ORGS)).toEqual([
      { name: "Stowarzyszenie Klucz", type: "stowarzyszenie", place: null, isSample: false, sourceUrl: "https://example.org/c001", fromCard: false },
    ]);
    const placed = pickRunBy(seniors, ORGS, [{ innovationId: "c001", place: "Pałecznica", stage: "test", isSample: false, sourceUrl: null }]);
    expect(placed[0]?.place).toBe("Pałecznica");
    expect(pickRunBy(seniors, [{ ...ORGS[0]!, place: "Bochnia" }])[0]?.place).toBe("Bochnia");
  });

  it("else the card's own authors line, without the private-persons note", () => {
    const card = { ...migrants, sections: { ...migrants.sections, authors: "Fundacja Pestka\n(oraz osoby prywatne — dane w źródle)" } };
    expect(pickRunBy(card, [])).toEqual([
      { name: "Fundacja Pestka", type: null, place: null, isSample: false, sourceUrl: card.sourceUrl, fromCard: true },
    ]);
    expect(authorsName(card)).toBe("Fundacja Pestka");
  });

  it("else nothing — the step is hidden, never filled in", () => {
    expect(pickRunBy(migrants, [])).toEqual([]);
  });
});

describe("pickMentor", () => {
  it("a mentor or expert for the card's first area, flagged as sample", () => {
    expect(pickMentor(migrants, PEOPLE)).toEqual({
      name: "Piotr Wróbel",
      role: "expert",
      title: "Ekspert — cudzoziemcy",
      areas: ["migrants", "health"],
      isSample: true,
    });
  });

  it("does not pick a mentor who only shares a later area of the card, nor ROPS staff", () => {
    const healthThenSeniors = { ...migrants, mapaAreas: ["health" as const, "seniors" as const] };
    const seniorsMentor: PersonRow = { id: "p3", displayName: "Anna", role: "mentor", title: null, orgName: null, areas: ["seniors"], isSample: true };
    expect(pickMentor(healthThenSeniors, [seniorsMentor])).toBeNull();
    expect(pickMentor(migrants, [PEOPLE[1]!])).toBeNull();
    expect(pickMentor({ ...migrants, mapaAreas: [] }, PEOPLE)).toBeNull();
  });
});

describe("buildPath", () => {
  it("keeps this card's rows only; the general call is not repeated on the card", () => {
    const path = buildPath(seniors, {
      sites: [
        { innovationId: "c001", place: "Pałecznica", stage: "test", isSample: false, sourceUrl: null },
        { innovationId: "c002", place: "Kraków", stage: "test", isSample: false, sourceUrl: null },
      ],
      orgs: ORGS,
      people: PEOPLE,
      calls: CALLS,
      listedIn: LISTED,
    });
    expect(path.runBy.map((o) => o.place)).toEqual(["Pałecznica"]);
    expect(path.funding).toMatchObject({ reason: "listed" });
    expect(buildPath(migrants, { sites: [], orgs: [], people: [], calls: CALLS, listedIn: new Map() })).toEqual({
      runBy: [],
      mentor: null,
      funding: null,
    });
  });
});
