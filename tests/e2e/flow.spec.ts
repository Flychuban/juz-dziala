/**
 * The jury loop, end to end, with no API key needed (keyword results):
 * describe a problem → results with a quoted card sentence → „Poproś ROPS o
 * pomoc" (contact: none) → case code → ROPS replies in /admin/cases → the
 * author sees the reply on /case/<code>. Plus a keyboard-only pass on „/".
 */
import { expect, test } from "@playwright/test";

import { createMatch, settle } from "./helpers";

test("pętla jury: opis → wyniki z cytatem → prośba → odpowiedź ROPS widoczna dla autora", async ({ page, browser }, testInfo) => {
  // 1–2. Describe a problem; results come with a quote from the card.
  await createMatch(page);
  const quote = page.locator("article blockquote").first();
  await expect(quote).toBeVisible();
  await expect(quote).toContainText("„");
  await expect(page.getByText(/^Źródło:/u).first()).toBeVisible();

  // 3. Ask ROPS for help, no contact → the case code is shown.
  await page.getByRole("button", { name: "Poproś ROPS o pomoc" }).click();
  await page.getByLabel("Sprawdzę sam(a) kodem sprawy").check();
  await page.getByRole("button", { name: "Wyślij prośbę" }).click();
  const link = page.locator("#case-private-link");
  await expect(link).toHaveValue(/\/case\/JD-[2-9A-Z]{4}-[2-9A-Z]{4}\?t=/u);
  const code = /JD-[2-9A-Z]{4}-[2-9A-Z]{4}/u.exec(await link.inputValue())![0];

  // 4. ROPS (demo login, its own browser context) finds the case and replies.
  const staffContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    locale: "pl-PL",
    viewport: testInfo.project.use.viewport ?? null,
  });
  const staff = await staffContext.newPage();
  await staff.goto("/api/demo-login?role=rops&next=/admin/cases");
  await settle(staff);
  await expect(staff.getByText(code).first()).toBeVisible();
  await staff.locator(`a[href$="${code}"]`).first().click();
  await expect(staff.getByRole("heading", { name: "Odpowiedz" })).toBeVisible();
  const reply = `Dzień dobry, odpowiadamy na sprawę ${code}. Zadzwonimy do ośrodka pomocy społecznej w Twojej gminie.`;
  await staff.getByLabel("Odpowiedź do autora").fill(reply);
  await staff.getByRole("button", { name: "Wyślij odpowiedź" }).click();
  await expect(staff.getByText("Odpowiedź jest w wątku", { exact: false })).toBeVisible();
  await staffContext.close();

  // 5. The author sees the reply with the code alone.
  await page.goto(`/case/${code}`);
  await settle(page);
  await expect(page.getByText(reply)).toBeVisible();
});

test("klawiatura na stronie głównej: link „Przejdź do treści”, opis, przycisk, Enter", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Przejdź do treści" })).toBeFocused();
  await page.keyboard.press("Enter"); // skip to <main>
  await page.keyboard.press("Tab");
  const description = page.getByLabel("Twój opis");
  await expect(description).toBeFocused();
  await page.keyboard.type("samotny senior");

  // The submit button comes before the example chips: at most the optional gmina field lies between.
  const submit = page.getByRole("button", { name: "Szukaj rozwiązań" });
  let presses = 0;
  while (!(await submit.evaluate((el) => el === document.activeElement)) && presses < 3) {
    await page.keyboard.press("Tab");
    presses++;
  }
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/match\/[0-9a-f-]{36}$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Gotowe rozwiązania dla Ciebie" })).toBeVisible();
});
