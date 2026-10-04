/**
 * English version. Polish stays the default; the toolbar link (or ?lang=en)
 * switches the whole site.
 *
 * 1. The switch works without JavaScript tricks and sets <html lang="en">.
 * 2. An English description finds verified solutions, with the quote shown as a
 *    translation of the Polish card.
 * 3. The crawl: on every route, no visible text (or aria-label) outside a
 *    lang="pl" island contains Polish letters, except proper names
 *    (messages/proper-names.json). Untranslated Polish must be marked lang="pl"
 *    (WCAG 3.1.2), so this is both the "everything is in English" proof and an
 *    accessibility check. axe runs on the same pages.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { blockingSummary, runAxe, settle } from "./helpers";
import { PUBLIC_ROUTES, STAFF_ROUTES } from "./routes";

const PROPER = (JSON.parse(readFileSync(join(process.cwd(), "messages", "proper-names.json"), "utf8")) as string[]).sort(
  (a, b) => b.length - a.length,
);

const EN_QUERY = "My mum is 80, lives alone in a village, hardly leaves the house and mixes up her pills.";

async function english(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "jd_lang", value: "en", url: baseURL }]);
}

/** Visible text and aria-labels outside lang="pl" that still contain Polish letters. */
async function polishLeaks(page: Page): Promise<string[]> {
  const found = await page.evaluate(() => {
    const out: string[] = [];
    const isPl = (el: Element | null) => el?.closest("[lang]")?.getAttribute("lang")?.startsWith("pl") ?? false;
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getClientRects();
      if (!r.length) return el.closest(".sr-only") !== null; // screen-reader text counts too
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none";
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent?.trim() ?? "";
      if (!el || !text || !/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)) continue;
      if (el.closest("script,style,noscript,textarea,input,nextjs-portal")) continue;
      if (isPl(el) || !visible(el)) continue;
      out.push(text.slice(0, 140));
    }
    for (const el of document.querySelectorAll("[aria-label],[title],[placeholder]")) {
      for (const a of ["aria-label", "title", "placeholder"]) {
        const v = el.getAttribute(a);
        if (v && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(v) && !isPl(el)) out.push(`[${a}] ${v.slice(0, 140)}`);
      }
    }
    return out;
  });
  const clean = (s: string) => {
    let t = s.replace(/„[^”]*”/g, "").replace(/"[^"]*"/g, "");
    for (const p of PROPER) t = t.split(p).join("");
    return t;
  };
  return [...new Set(found)].filter((s) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(clean(s)));
}

test.describe("English version", () => {
  test("the switch turns the whole site to English and back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await page.locator('a[href^="/api/lang?to=en"]:visible').first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
    await page.locator('a[href^="/api/lang?to=pl"]:visible').first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("?lang=en opens the English version from a shared link", async ({ page }) => {
    await page.goto("/library?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(new URL(page.url()).searchParams.get("lang")).toBeNull();
  });

  test("an English description finds verified solutions with translated quotes", async ({ page, context, baseURL }) => {
    test.skip(test.info().project.name !== "desktop-1280", "one run is enough");
    await english(context, baseURL!);
    await page.goto("/");
    await page.locator("main textarea").first().fill(EN_QUERY);
    await page.locator("main form button[type=submit]").first().click();
    await page.waitForURL(/\/match\//, { timeout: 60_000 });
    await expect(page.locator("main article").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("main article").first()).toContainText(/Translated from the Polish card/i, {
      timeout: 90_000,
    });
    expect(await polishLeaks(page)).toEqual([]);
  });

  test.describe("crawl: no untranslated Polish outside lang=pl, and axe passes", () => {
    test.skip(({ browserName }) => browserName !== "chromium");

    for (const route of PUBLIC_ROUTES) {
      test(`public ${route.path}`, async ({ page, context, baseURL }) => {
        test.skip(test.info().project.name !== "desktop-1280", "crawl once");
        await english(context, baseURL!);
        await page.goto(route.path);
        await settle(page);
        expect(await polishLeaks(page), route.path).toEqual([]);
        const blocking = (await runAxe(page)).filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(blocking, blockingSummary(blocking)).toEqual([]);
      });
    }

    for (const route of [...STAFF_ROUTES, { path: "/admin/trends", name: "Trends" }, { path: "/admin/library", name: "Library editor" }, { path: "/admin/calls", name: "Calls" }, { path: "/admin/ai", name: "AI" }]) {
      test(`staff ${route.path}`, async ({ page, context, baseURL }) => {
        test.skip(test.info().project.name !== "desktop-1280", "crawl once");
        await english(context, baseURL!);
        await page.goto(`/api/demo-login?role=rops&next=${encodeURIComponent(route.path)}`);
        await settle(page);
        expect(await polishLeaks(page), route.path).toEqual([]);
      });
    }

    test("expert /expert", async ({ page, context, baseURL }) => {
      test.skip(test.info().project.name !== "desktop-1280", "crawl once");
      await english(context, baseURL!);
      await page.goto("/api/demo-login?role=expert&next=/expert");
      await settle(page);
      expect(await polishLeaks(page)).toEqual([]);
    });
  });
});
