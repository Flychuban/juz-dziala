import { describe, expect, it } from "vitest";

import { FIXTURE_CARDS } from "~/server/domain/__fixtures__/cards";
import { buildPath, pickFunding, pickHelpers, type CallRow, type OrgRow, type PersonRow } from "./path";

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

  it("otherwise offers the IWS/demo call, preferring demo over a closed one, and never mentorES", () => {
    expect(pickFunding(migrants, CALLS, LISTED)).toMatchObject({ id: "demo-iws", reason: "general", status: "demo" });
    expect(pickFunding(migrants, CALLS.filter((c) => c.id !== "demo-iws"), LISTED)).toMatchObject({ id: "iws-2-0" });
    expect(pickFunding(migrants, CALLS.filter((c) => c.id.startsWith("mentores")), LISTED)).toBeNull();
  });
});

const ORGS: OrgRow[] = [
  { name: "Stowarzyszenie Klucz", type: "stowarzyszenie", innovationIds: ["c001"], isSample: false, sourceUrl: "https://example.org/c001" },
];
const PEOPLE: PersonRow[] = [
  { id: "p1", displayName: "Piotr Wróbel", role: "expert", title: "Ekspert — cudzoziemcy", orgName: null, areas: ["migrants", "health"], isSample: true },
  { id: "p2", displayName: "Zespół", role: "rops", title: null, orgName: null, areas: ["migrants"], isSample: true },
];

describe("pickHelpers", () => {
  it("prefers the organisation behind the card", () => {
    expect(pickHelpers(seniors, ORGS, PEOPLE)).toEqual([
      { name: "Stowarzyszenie Klucz", kind: "org", detail: "stowarzyszenie", isSample: false, sourceUrl: "https://example.org/c001" },
    ]);
  });

  it("else a mentor or expert for the card's area, flagged as sample", () => {
    expect(pickHelpers(migrants, ORGS, PEOPLE)).toEqual([
      { name: "Piotr Wróbel", kind: "mentor", detail: "Ekspert — cudzoziemcy", isSample: true, sourceUrl: null },
    ]);
  });

  it("else nothing invented: the card's own authors line, or an empty list", () => {
    expect(pickHelpers(migrants, [], [])).toEqual([]);
  });
});

describe("buildPath", () => {
  it("keeps sites of this card only and leaves an empty step empty", () => {
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
    expect(path.sites.map((s) => s.place)).toEqual(["Pałecznica"]);
    expect(buildPath(migrants, { sites: [], orgs: [], people: [], calls: [], listedIn: new Map() })).toEqual({
      sites: [],
      helpers: [],
      funding: null,
    });
  });
});
