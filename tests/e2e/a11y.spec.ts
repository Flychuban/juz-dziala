/**
 * Accessibility: axe-core (WCAG 2.0/2.1 A + AA) on every route, both projects.
 * Serious and critical violations fail the test; every result, including
 * moderate and minor ones, is written to test-results/a11y-<project>.json for
 * scripts/a11y-report.ts. On the 360 px project each route is also checked
 * for horizontal scrolling at 320 CSS px (WCAG 1.4.10 reflow; fails the
 * test) and, for information only, at 180 px (200 % zoom on a 360 px phone).
 */
import { expect, test, type Page } from "@playwright/test";

import {
  blockingSummary,
  checkReflow,
  createMatch,
  mergeResults,
  runAxe,
  saveResult,
  settle,
  type RouteResult,
} from "./helpers";
import { MATCH_ROUTE, PUBLIC_ROUTES, STAFF_ROUTES, type Route } from "./routes";

async function audit(page: Page, route: Route, project: string, url: string): Promise<RouteResult> {
  const violations = await runAxe(page);
  const result: RouteResult = {
    route: route.path,
    name: route.name,
    project,
    url,
    checkedAt: new Date().toISOString(),
    violations,
  };
  if (project === "mobile-360") {
    result.reflow = await checkReflow(page, 320);
    result.reflowStrict = await checkReflow(page, 180);
  }
  saveResult(result);
  return result;
}

function assertClean(result: RouteResult) {
  const blocking = blockingSummary(result.violations);
  expect.soft(blocking, `Poważne/krytyczne naruszenia WCAG na ${result.route}`).toBe("");
  if (result.reflow) {
    expect
      .soft(
        result.reflow.ok,
        `Przewijanie w poziomie przy 320 px (WCAG 1.4.10) na ${result.route}: ${result.reflow.scrollWidth} > ${result.reflow.innerWidth}\n  ${result.reflow.culprits.join("\n  ")}`,
      )
      .toBe(true);
  }
  if (result.reflowStrict) {
    test.info().annotations.push({
      type: "info",
      description: `180 px (200% na 360 px, ponad WCAG): ${result.reflowStrict.ok ? "bez przewijania" : `przewijanie ${result.reflowStrict.scrollWidth} px`}`,
    });
  }
}

test.afterAll(({}, testInfo) => {
  mergeResults(testInfo.project.name);
});

for (const route of PUBLIC_ROUTES) {
  test(`a11y ${route.path}`, async ({ page }, testInfo) => {
    const res = await page.goto(route.path);
    expect(res?.status(), `HTTP ${route.path}`).toBeLessThan(400);
    await settle(page, route.wait);
    assertClean(await audit(page, route, testInfo.project.name, route.path));
  });
}

test(`a11y ${MATCH_ROUTE.path}`, async ({ page }, testInfo) => {
  const id = await createMatch(page);
  await settle(page);
  assertClean(await audit(page, MATCH_ROUTE, testInfo.project.name, `/match/${id}`));
});

test.describe("staff", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/api/demo-login?role=rops&next=/admin");
    await settle(page);
  });

  for (const route of STAFF_ROUTES) {
    test(`a11y ${route.path}`, async ({ page }, testInfo) => {
      const res = await page.goto(route.path);
      expect(res?.status(), `HTTP ${route.path}`).toBeLessThan(400);
      await settle(page, route.wait);
      assertClean(await audit(page, route, testInfo.project.name, route.path));
    });
  }
});
