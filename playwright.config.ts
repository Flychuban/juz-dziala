import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility tests (tests/e2e).
 *
 *   pnpm test:e2e                                   # starts `pnpm dev --port 3101` itself
 *   E2E_BASE_URL=https://… pnpm test:e2e            # against a running deployment
 *   pnpm exec tsx scripts/a11y-report.ts            # → docs/DOSTEPNOSC-RAPORT.md
 *
 * Two projects: a 360 px phone and a 1280 px desktop, both in Polish.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/artifacts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-report.json" }]],
  use: {
    baseURL,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    trace: "retain-on-failure",
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, hasTouch: true },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --port 3101",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
