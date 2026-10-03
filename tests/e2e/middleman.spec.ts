/**
 * Module VII — Middleman Innowacji and „Dla gminy". Both projects (360 px,
 * 1280 px): the gmina profile and the generated plan pass axe (no serious or
 * critical WCAG violations) and reflow at 320 px; the profile's „Zaplanuj
 * usługę" opens the wizard on the gmina's first fitting innovation; the plan
 * never shows internal sentence ids.
 */
import { expect, test } from "@playwright/test";

import { blockingSummary, checkReflow, runAxe, settle } from "./helpers";

const GREBOSZOW = "1204032";

test("profil gminy: dane GUS, potrzeby (k ≥ 5), reguła i dostępność", async ({ page }, testInfo) => {
  const res = await page.goto(`/municipality/${GREBOSZOW}`);
  expect(res?.status()).toBeLessThan(400);
  await settle(page);

  await expect(page.getByRole("heading", { level: 1, name: "Gręboszów" })).toBeVisible();
  // Plural agrees with the number („3112 osób", „10 123 osoby").
  await expect(page.getByText(/Mieszka tu [\d  ]+ (osoba|osoby|osób);/)).toBeVisible();
  await expect(page.getByText("Ludność gminy maleje")).toBeVisible();
  // Fewer than 5 needs in the powiat: one sentence, no table of „mniej niż 5".
  const needs = page.locator("section", { has: page.getByRole("heading", { name: "Potrzeby zgłaszane w powiecie" }) });
  const sentence = needs.getByText(/za mało, by pokazać szczegóły bez ryzyka rozpoznania osób/);
  if (await sentence.count()) {
    await expect(needs.getByRole("table")).toHaveCount(0);
  }
  // The rule is printed, and the list leads with seniors and getting around.
  await expect(page.getByText(/Udział osób w wieku 80\+ wyższy niż mediana/)).toBeVisible();
  const first = page.locator("#recs-h ~ ul > li").first();
  await expect(first).toContainText("Seniorzy");
  await expect(first).toContainText("Dojazd i poruszanie się");
  await expect(page.getByText(/Dostępna szermierka/)).toHaveCount(0);

  const blocking = blockingSummary(await runAxe(page));
  expect.soft(blocking, "Poważne/krytyczne naruszenia WCAG").toBe("");
  if (testInfo.project.name === "mobile-360") {
    const reflow = await checkReflow(page, 320);
    expect.soft(reflow.ok, reflow.culprits.join("\n")).toBe(true);
  }
});

test("Zaplanuj usługę w tej gminie → kreator z pierwszym rozwiązaniem → plan bez wewnętrznych identyfikatorów", async ({ page }, testInfo) => {
  await page.goto(`/municipality/${GREBOSZOW}`);
  await settle(page);
  const firstTitle = (
    await page.locator("#recs-h ~ ul > li h3").first().innerText()
  ).trim();

  await page.getByRole("link", { name: /Zaplanuj usługę w tej gminie/ }).click();
  await expect(page).toHaveURL(/\/adapt\?innovation=[^&]+&gmina=1204032/);
  await settle(page, /Którą innowację chcesz wdrożyć/);

  // Step 1: the profile's first innovation is already chosen.
  const escaped = firstTitle.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page.getByRole("radio", { name: new RegExp(escaped) })).toBeChecked();
  await page.getByRole("button", { name: "Dalej" }).click();

  // Step 2: institution.
  await page.getByRole("radio", { name: /Ośrodek pomocy społecznej \(OPS\)/ }).check();
  await page.getByRole("button", { name: "Dalej" }).click();

  // Step 3: the gmina is preselected.
  await expect(page.getByText(/Wybrano: Gręboszów \(gmina wiejska\)/)).toBeVisible();
  await page.getByRole("button", { name: "Dalej" }).click();

  // Step 4: resources.
  await page.getByRole("radio", { name: "2–3 osoby", exact: true }).check();
  await page.getByRole("radio", { name: "200–600 tys. zł", exact: true }).check();
  await page.getByRole("radio", { name: "12 miesięcy", exact: true }).check();
  await page.getByLabel(/Ilu osobom chcesz pomóc/).fill("40");
  await page.getByRole("button", { name: "Przygotuj plan" }).click();

  const plan = page.getByRole("article", { name: "Ramowy Plan Wdrożenia" });
  await expect(page.getByText(/Plan gotowy/)).toBeVisible({ timeout: 110_000 });
  await expect(plan).toContainText("10. Finansowanie");
  await expect(plan).toContainText("(karta, sekcja „Grupa docelowa”)");
  expect(await plan.innerText()).not.toMatch(/\bc\d{3}\.s\d+\b/);
  await expect(page.getByText(/wymaga weryfikacji przez specjalistę ROPS/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Drukuj plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pobierz jako tekst/ })).toBeVisible();

  const blocking = blockingSummary(await runAxe(page));
  expect.soft(blocking, "Poważne/krytyczne naruszenia WCAG w planie").toBe("");
  if (testInfo.project.name === "mobile-360") {
    const reflow = await checkReflow(page, 320);
    expect.soft(reflow.ok, reflow.culprits.join("\n")).toBe(true);
  }
});
