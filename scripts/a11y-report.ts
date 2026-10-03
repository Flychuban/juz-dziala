/**
 * Summarises test-results/a11y-<project>.json (written by tests/e2e/a11y.spec.ts)
 * into docs/DOSTEPNOSC-RAPORT.md: route × screen × violations by impact, the
 * 200 % zoom check, and every serious/critical violation with its selectors.
 *
 *   pnpm test:e2e tests/e2e/a11y.spec.ts && pnpm exec tsx scripts/a11y-report.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Violation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: { target: string; html: string; summary: string }[];
};
type RouteResult = {
  route: string;
  name: string;
  project: string;
  url: string;
  checkedAt: string;
  violations: Violation[];
  reflow?: { ok: boolean; scrollWidth: number; innerWidth: number; culprits?: string[] };
};
type ProjectFile = { project: string; generatedAt: string; tags: string[]; results: RouteResult[] };

const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
const IMPACT_PL: Record<string, string> = {
  critical: "krytyczne",
  serious: "poważne",
  moderate: "umiarkowane",
  minor: "drobne",
};
const PROJECT_PL: Record<string, string> = { "mobile-360": "Telefon 360 px", "desktop-1280": "Komputer 1280 px" };
const PROJECTS = ["mobile-360", "desktop-1280"];

export function countByImpact(violations: readonly Violation[]): Record<string, number> {
  const out: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) out[v.impact ?? "minor"] = (out[v.impact ?? "minor"] ?? 0) + v.nodes.length;
  return out;
}

export function cell(r: RouteResult | undefined): string {
  if (!r) return "nie sprawdzono";
  const c = countByImpact(r.violations);
  const blocking = (c.critical ?? 0) + (c.serious ?? 0);
  const parts = IMPACTS.filter((i) => (c[i] ?? 0) > 0).map((i) => `${IMPACT_PL[i]} ${c[i]}`);
  const status = blocking === 0 ? "zaliczone" : "do poprawy";
  const reflow = r.reflow ? (r.reflow.ok ? " · 200%: bez przewijania" : ` · 200%: przewijanie (${r.reflow.scrollWidth} px)`) : "";
  return `${status}${parts.length ? ` (${parts.join(", ")})` : " (0 naruszeń)"}${reflow}`;
}

const esc = (s: string) => s.replace(/\|/gu, "\\|").replace(/\n/gu, " ");

export function renderReport(files: readonly ProjectFile[]): string {
  const byKey = new Map<string, RouteResult>();
  const routes: { route: string; name: string }[] = [];
  for (const f of files) {
    for (const r of f.results) {
      byKey.set(`${r.project}|${r.route}`, r);
      if (!routes.some((x) => x.route === r.route)) routes.push({ route: r.route, name: r.name });
    }
  }
  const generated = files.map((f) => f.generatedAt).sort().at(-1) ?? new Date().toISOString();
  const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(
    new Date(generated),
  );
  const all = [...byKey.values()];
  const passed = all.filter((r) => countByImpact(r.violations).critical === 0 && countByImpact(r.violations).serious === 0);
  const reflowFails = all.filter((r) => r.reflow && !r.reflow.ok);

  const lines: string[] = [];
  lines.push("# Raport dostępności — test automatyczny WCAG 2.1 AA", "");
  lines.push(
    `Stan na: ${date}. Narzędzie: axe-core (@axe-core/playwright) w przeglądarce Chromium uruchamianej przez Playwright.`,
    `Reguły: WCAG 2.0 i 2.1, poziomy A i AA (${files[0]?.tags.join(", ") ?? ""}). Ekrany: telefon 360 px i komputer 1280 px.`,
    "Na telefonie sprawdzamy też powiększenie 200% (WCAG 1.4.10): strona ułożona na 180 px szerokości nie może przewijać się w poziomie.",
    "",
    `Wynik: ${passed.length} z ${all.length} sprawdzeń bez naruszeń poważnych i krytycznych; ${reflowFails.length} ${reflowFails.length === 1 ? "ekran przewija" : "ekranów przewija"} się w poziomie przy 200%.`,
    "",
    "Test automatyczny nie zastępuje sprawdzenia z czytnikiem ekranu i samą klawiaturą — część kryteriów WCAG ocenia tylko człowiek.",
    "",
    "## Wyniki według ekranów",
    "",
    `| Ekran | Adres | ${PROJECTS.map((p) => PROJECT_PL[p]).join(" | ")} |`,
    `|---|---|${PROJECTS.map(() => "---").join("|")}|`,
  );
  for (const r of routes) {
    lines.push(`| ${esc(r.name)} | \`${r.route}\` | ${PROJECTS.map((p) => esc(cell(byKey.get(`${p}|${r.route}`)))).join(" | ")} |`);
  }

  const blocking = all.flatMap((r) =>
    r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => ({ r, v })),
  );
  lines.push("", "## Naruszenia poważne i krytyczne", "");
  if (blocking.length === 0) lines.push("Brak.");
  for (const { r, v } of blocking) {
    lines.push(`- **${IMPACT_PL[v.impact ?? ""] ?? v.impact}** · \`${r.route}\` · ${PROJECT_PL[r.project] ?? r.project} · reguła \`${v.id}\` — ${esc(v.help)} ([opis](${v.helpUrl}))`);
    for (const n of v.nodes.slice(0, 5)) lines.push(`  - \`${esc(n.target)}\``);
  }

  const minor = new Map<string, { help: string; impact: string; count: number; routes: Set<string> }>();
  for (const r of all) {
    for (const v of r.violations) {
      if (v.impact === "critical" || v.impact === "serious") continue;
      const e = minor.get(v.id) ?? { help: v.help, impact: v.impact ?? "minor", count: 0, routes: new Set<string>() };
      e.count += v.nodes.length;
      e.routes.add(r.route);
      minor.set(v.id, e);
    }
  }
  lines.push("", "## Naruszenia umiarkowane i drobne", "");
  if (minor.size === 0) lines.push("Brak.");
  for (const [id, e] of minor) {
    lines.push(`- \`${id}\` (${IMPACT_PL[e.impact] ?? e.impact}, ${e.count} elem.) — ${esc(e.help)}; ekrany: ${[...e.routes].map((x) => `\`${x}\``).join(", ")}`);
  }

  if (reflowFails.length > 0) {
    lines.push("", "## Przewijanie w poziomie przy powiększeniu 200%", "");
    for (const r of reflowFails) {
      lines.push(`- \`${r.route}\`: szerokość strony ${r.reflow!.scrollWidth} px przy oknie ${r.reflow!.innerWidth} px`);
      for (const c of r.reflow!.culprits ?? []) lines.push(`  - ${esc(c)}`);
    }
  }
  lines.push("", "Jak powtórzyć: `pnpm test:e2e tests/e2e/a11y.spec.ts`, potem `pnpm exec tsx scripts/a11y-report.ts`.", "");
  return lines.join("\n");
}

function main() {
  const dir = join(process.cwd(), "test-results");
  const files: ProjectFile[] = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^a11y-.+\.json$/u.test(f))
        .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ProjectFile)
    : [];
  if (files.length === 0) {
    console.log("Brak plików test-results/a11y-*.json. Najpierw: pnpm test:e2e tests/e2e/a11y.spec.ts");
    return;
  }
  const out = join(process.cwd(), "docs", "DOSTEPNOSC-RAPORT.md");
  writeFileSync(out, renderReport(files));
  console.log(`zapisano ${out}`);
}

if (process.argv[1]?.endsWith("a11y-report.ts")) main();
