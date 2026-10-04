/**
 * Makiety UX/UI: screenshots of the real screens at phone (390 px) and desktop
 * (1280 px) widths, into docs/makiety/. Run against a deployed or local app:
 *   SHOT_BASE_URL=https://juz-dziala.vercel.app pnpm exec tsx scripts/screenshots.ts
 */
import { mkdirSync } from "node:fs";

import { chromium, type Page } from "@playwright/test";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/makiety";
const VIEWPORTS = [
  { name: "telefon", width: 390, height: 844 },
  { name: "komputer", width: 1280, height: 860 },
] as const;

type Shot = {
  id: string;
  title: string;
  path: string | ((p: Page) => Promise<string>);
  staff?: boolean;
  full?: boolean;
  /** "en" = the English version (jd_lang cookie). */
  lang?: "en";
};

const QUERY = "Mama ma 73 lata, owdowiała, mieszka sama pod Limanową, prawie nie wychodzi z domu i myli leki.";

const QUERY_EN = "My mum is 80, lives alone in a village, hardly leaves the house and mixes up her pills.";

/** One AI-verified match per language, reused for both widths (one AI call each). */
const matchCache = new Map<string, string>();
// Reuse stored runs (no AI call): SHOT_MATCH_PL=/match/<id> SHOT_MATCH_EN=/match/<id>
if (process.env.SHOT_MATCH_PL) matchCache.set("pl", process.env.SHOT_MATCH_PL);
if (process.env.SHOT_MATCH_EN) matchCache.set("en", process.env.SHOT_MATCH_EN);
async function createMatch(page: Page, lang: "pl" | "en" = "pl"): Promise<string> {
  const cached = matchCache.get(lang);
  if (cached) {
    await page.goto(`${BASE}${cached}`, { waitUntil: "networkidle" });
    return cached;
  }
  await page.goto(`${BASE}/`);
  await page.locator("main textarea").first().fill(lang === "en" ? QUERY_EN : QUERY);
  await page.locator("main form button[type=submit]").first().click();
  await page.waitForURL(/\/match\//, { timeout: 30_000 });
  // Wait for the AI upgrade so the mockup shows verified results.
  await page
    .getByText(lang === "en" ? "Checked by AI" : "Sprawdzone przez AI")
    .first()
    .waitFor({ timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
  const path = new URL(page.url()).pathname;
  matchCache.set(lang, path);
  return path;
}

const ONLY = process.env.SHOT_ONLY?.split(",");
const ALL_SHOTS: Shot[] = [
  { id: "01-start", title: "Opisz problem", path: "/" },
  { id: "02-wyniki", title: "Gotowe rozwiązania dla Ciebie", path: (p) => createMatch(p, "pl"), full: true },
  { id: "03-biblioteka", title: "Biblioteka Innowacji Społecznych", path: "/library" },
  { id: "04-karta", title: "Karta innowacji", path: "/library/mobilne-centrum-pomocy-dla-osob-starszych" },
  { id: "05-kondycja", title: "Kondycja Małopolski — Seniorzy", path: "/knowledge/seniors" },
  { id: "06-pomysl", title: "Kreator pomysłów", path: "/ideas/new" },
  { id: "07-tester", title: "Tester innowacji", path: "/test" },
  { id: "08-siec", title: "Sieć i mentorzy", path: "/network" },
  { id: "09-gmina", title: "Dla gminy", path: "/municipality" },
  { id: "10-middleman", title: "Zaplanuj usługę", path: "/adapt" },
  { id: "11-pulpit", title: "Panel ROPS — pulpit", path: "/admin", staff: true },
  { id: "12-sprawy", title: "Panel ROPS — sprawy", path: "/admin/cases", staff: true },
  { id: "13-trendy", title: "Trendy i białe plamy", path: "/admin/trends", staff: true, full: true },
  { id: "14-dostepnosc", title: "Deklaracja dostępności", path: "/accessibility" },
  { id: "15-partnerzy", title: "Szukam partnera — partnerstwa przez ROPS", path: "/network#partnerzy" },
  { id: "16-english-start", title: "English version — home", path: "/", lang: "en" },
  { id: "17-english-wyniki", title: "English version — verified results with translated quotes", path: (p) => createMatch(p, "en"), lang: "en", full: true },
  { id: "18-english-pulpit", title: "English version — ROPS dashboard", path: "/admin", staff: true, lang: "en" },
];
const SHOTS = ONLY ? ALL_SHOTS.filter((s) => ONLY.includes(s.id)) : ALL_SHOTS;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "pl-PL", deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    let staff = false;
    for (const s of SHOTS) {
      await ctx.addCookies([{ name: "jd_lang", value: s.lang ?? "pl", url: BASE }]);
      if (s.staff && !staff) {
        await page.goto(`${BASE}/api/demo-login?role=rops&next=/admin`);
        staff = true;
      } else if (!s.staff && staff) {
        // Resident screens are shot as a resident (no staff bar).
        await page.goto(`${BASE}/api/demo-login?role=none&next=/`);
        staff = false;
      }
      const path = typeof s.path === "string" ? s.path : await s.path(page);
      if (typeof s.path === "string") await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${s.id}-${vp.name}.png`, fullPage: s.full ?? vp.name === "telefon" });
      console.log(`✓ ${s.id} ${vp.name}`);
    }
    await ctx.close();
  }
  await browser.close();
}

void main();
