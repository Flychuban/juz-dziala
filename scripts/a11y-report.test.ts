import { describe, expect, it } from "vitest";

import { cell, countByImpact, renderReport } from "./a11y-report";

const v = (id: string, impact: string, nodes = 1) => ({
  id,
  impact,
  help: `Pomoc ${id}`,
  helpUrl: `https://example.org/${id}`,
  nodes: Array.from({ length: nodes }, (_, i) => ({ target: `#el${i}`, html: "<div>", summary: "" })),
});

const result = (route: string, project: string, violations: ReturnType<typeof v>[], reflowOk = true) => ({
  route,
  name: route,
  project,
  url: route,
  checkedAt: "2026-10-03T16:00:00Z",
  violations,
  ...(project === "mobile-360" ? { reflow: { ok: reflowOk, scrollWidth: reflowOk ? 180 : 214, innerWidth: 180, culprits: reflowOk ? [] : ["div.toolbar (196 px)"] } } : {}),
});

describe("countByImpact", () => {
  it("counts affected elements per impact", () => {
    expect(countByImpact([v("a", "serious", 2), v("b", "minor")])).toEqual({ critical: 0, serious: 2, moderate: 0, minor: 1 });
  });
});

describe("cell", () => {
  it("says pass/fail in Polish, with counts and the 200% check", () => {
    expect(cell(result("/", "desktop-1280", []))).toBe("zaliczone (0 naruszeń)");
    expect(cell(result("/", "mobile-360", [v("x", "critical")], false))).toBe("do poprawy (krytyczne 1) · 200%: przewijanie (214 px)");
    expect(cell(undefined)).toBe("nie sprawdzono");
  });
});

describe("renderReport", () => {
  it("renders the route table, the blocking list and the reflow culprits", () => {
    const md = renderReport([
      { project: "mobile-360", generatedAt: "2026-10-03T16:00:00Z", tags: ["wcag2a"], results: [result("/", "mobile-360", [], false)] },
      { project: "desktop-1280", generatedAt: "2026-10-03T16:00:00Z", tags: ["wcag2a"], results: [result("/", "desktop-1280", [v("color-contrast", "serious")])] },
    ]);
    expect(md).toContain("| Ekran | Adres | Telefon 360 px | Komputer 1280 px |");
    expect(md).toContain("reguła `color-contrast`");
    expect(md).toContain("div.toolbar (196 px)");
    expect(md).toContain("Wynik: 1 z 2 sprawdzeń");
  });
});
