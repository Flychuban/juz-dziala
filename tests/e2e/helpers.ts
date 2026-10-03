import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { MATCH_QUERY } from "./routes";

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
export const BLOCKING = new Set(["serious", "critical"]);

export type Violation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: { target: string; html: string; summary: string }[];
};
export type RouteResult = {
  route: string;
  name: string;
  project: string;
  url: string;
  checkedAt: string;
  violations: Violation[];
  /** WCAG 1.4.10 reflow: horizontal scroll at 320 CSS px (360 px project only), with the outermost elements that stick out. */
  reflow?: Reflow;
  /** Informational, stricter than WCAG: 200 % zoom on a 360 px phone, i.e. a 180 px layout. Never fails the run. */
  reflowStrict?: Reflow;
  error?: string;
};

const RESULTS_DIR = join(process.cwd(), "test-results", "a11y");

/** Waits for the page to settle: main landmark, fonts, no pending „Wczytuję…" status. */
export async function settle(page: Page, wait?: RegExp): Promise<void> {
  await page.locator("main").first().waitFor({ state: "visible" });
  if (wait) await expect(page.getByText(wait).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(300);
}

export async function runAxe(page: Page): Promise<Violation[]> {
  const res = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude("nextjs-portal") // Next.js dev overlay, absent in production
    .analyze();
  return res.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.slice(0, 10).map((n) => ({
      target: n.target.map(String).join(" "),
      html: n.html.slice(0, 300),
      summary: (n.failureSummary ?? "").slice(0, 500),
    })),
  }));
}

/**
 * WCAG 1.4.10 at 200 % zoom on a 360 px phone: browser zoom halves the CSS
 * viewport, so the page is laid out at 180 CSS px and must not scroll sideways.
 */
export type Reflow = { ok: boolean; scrollWidth: number; innerWidth: number; culprits: string[] };

/**
 * Horizontal scrolling at `width` CSS px. WCAG 1.4.10 asks for no
 * two-dimensional scrolling at 320 CSS px (≈ 1280 px at 400 % zoom).
 */
export async function checkReflow(page: Page, width = 320): Promise<Reflow> {
  const original = page.viewportSize();
  await page.setViewportSize({ width, height: 640 });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const W = window.innerWidth;
    const describe = (el: Element) => {
      const cls = (el.getAttribute("class") ?? "").split(/\s+/u).filter(Boolean).slice(0, 4).join(".");
      const text = (el.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""} (${Math.round(el.getBoundingClientRect().width)} px) „${text}”`;
    };
    const sticksOut = (el: Element) => el.getBoundingClientRect().right > W + 1;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === "auto" || o === "scroll" || o === "hidden") && !sticksOut(p)) return true;
      }
      return false;
    };
    const culprits: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (culprits.length >= 5) break;
      if (el.getBoundingClientRect().width === 0 || !sticksOut(el) || inScroller(el)) continue;
      const parent = el.parentElement;
      if (parent && parent !== document.body && sticksOut(parent)) continue; // report the outermost only
      culprits.push(describe(el));
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: W, culprits };
  });
  if (original) await page.setViewportSize(original);
  return { ok: m.scrollWidth <= m.innerWidth + 1, ...m };
}

const slug = (route: string) => route.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "") || "home";

export function saveResult(r: RouteResult): void {
  const dir = join(RESULTS_DIR, r.project);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug(r.route)}.json`), JSON.stringify(r, null, 2));
}

/** Merges the per-route files into test-results/a11y-<project>.json (idempotent). */
export function mergeResults(project: string): void {
  const dir = join(RESULTS_DIR, project);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return;
  }
  const results = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as RouteResult);
  writeFileSync(
    join(process.cwd(), "test-results", `a11y-${project}.json`),
    JSON.stringify({ project, generatedAt: new Date().toISOString(), tags: WCAG_TAGS, results }, null, 2),
  );
}

export function blockingSummary(violations: Violation[]): string {
  return violations
    .filter((v) => v.impact !== null && BLOCKING.has(v.impact))
    .map((v) => `${v.impact} ${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target).join("\n  ")}`)
    .join("\n");
}

/** Describes a problem on the home page and waits for /match/<id>. Returns the run id. */
export async function createMatch(page: Page, text = MATCH_QUERY): Promise<string> {
  await page.goto("/");
  await settle(page);
  await page.getByLabel("Twój opis").fill(text);
  await page.getByRole("button", { name: "Szukaj rozwiązań" }).click();
  await page.waitForURL(/\/match\/[0-9a-f-]{36}$/u);
  const id = /\/match\/([0-9a-f-]{36})$/u.exec(page.url())?.[1];
  if (!id) throw new Error(`no match id in ${page.url()}`);
  // Results (or the abstain view) are on screen once the page has settled.
  await expect(page.getByRole("heading", { level: 1, name: "Gotowe rozwiązania dla Ciebie" })).toBeVisible();
  await expect(page.locator("article, #abstain-heading").first()).toBeVisible();
  // Let the AI step finish (or report that it could not run) so the cards stop changing under the test.
  await expect(
    page.getByText(/Sprawdzone przez AI|Nie mamy pewnego dopasowania|Pokazujemy wyniki wyszukiwania/u).first(),
  ).toBeVisible({ timeout: 60_000 });
  return id;
}
