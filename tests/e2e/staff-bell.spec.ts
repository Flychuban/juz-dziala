/**
 * The administrator is told about a new case, and the author hears the reply.
 * Two browser contexts: a resident (no login) and ROPS (demo login).
 *
 * 1. A new case → the ROPS bell shows an unread badge, the tab title becomes
 *    „(N) Nowa sprawa · Już Działa" and a desktop notification is raised
 *    (Notification is stubbed as already granted) — all within one 5 s poll.
 * 2. „Użyj szkicu" puts the triage draft into the reply box; the reply reaches
 *    the author's open case page and is announced through aria-live.
 */
import { expect, test, type Browser, type TestInfo } from "@playwright/test";

import { settle } from "./helpers";

const TITLE_BADGE = /^\(\d+\) Nowa sprawa · Już Działa$/u;

async function contexts(browser: Browser, testInfo: TestInfo) {
  const opts = {
    baseURL: testInfo.project.use.baseURL,
    locale: "pl-PL",
    viewport: testInfo.project.use.viewport ?? null,
  };
  const staffContext = await browser.newContext(opts);
  // A desktop notification permission that is already granted, recording calls.
  await staffContext.addInitScript(() => {
    const w = window as unknown as {
      __notes: { title: string; body?: string }[];
      Notification: unknown;
    };
    w.__notes = [];
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclick: (() => void) | null = null;
      constructor(title: string, opts?: { body?: string }) {
        w.__notes.push({ title, body: opts?.body });
      }
      close() {}
    }
    w.Notification = FakeNotification;
  });
  const authorContext = await browser.newContext(opts);
  return { staffContext, authorContext };
}

/** Opens a case as a resident through the public API (own session → own rate limit). */
async function createCase(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("/case");
  await settle(page);
  const res = await page.request.post("/api/trpc/cases.create", {
    data: {
      json: {
        kind: "need",
        title,
        body: "Sąsiad po udarze mieszka sam i nikt nie robi mu zakupów. Szukam pomocy dla seniora.",
        contactPref: "none",
      },
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const json = (await res.json()) as {
    result: { data: { json: { code: string; accessToken: string } } };
  };
  return json.result.data.json;
}

test("dzwonek ROPS: licznik, tytuł karty i powiadomienie na pulpicie po nowej sprawie", async ({
  browser,
}, testInfo) => {
  const { staffContext, authorContext } = await contexts(browser, testInfo);
  const staff = await staffContext.newPage();
  await staff.goto("/api/demo-login?role=rops&next=/admin");
  await settle(staff);
  await staff.request.post("/api/trpc/notifications.markRead", {
    data: { json: { all: true } },
  });
  const bell = staff.getByRole("button", { name: /^Powiadomienia/u });
  await expect(bell).toBeVisible();

  const title = `Test dzwonka ${Date.now()} ${testInfo.project.name}`;
  const { code } = await createCase(await authorContext.newPage(), title);

  // Within one poll (5 s) plus slack: the badge, the tab title, the desktop notification.
  await expect(bell).toContainText(/\d+/u, { timeout: 15_000 });
  await expect(staff).toHaveTitle(TITLE_BADGE, { timeout: 15_000 });
  await expect
    .poll(() =>
      staff.evaluate(() =>
        (window as unknown as { __notes: { body?: string }[] }).__notes.map(
          (n) => n.body,
        ),
      ),
    )
    .toContain(title);

  // The dropdown lists the case and leads to it.
  await bell.click();
  const item = staff.getByRole("link", {
    name: new RegExp(`Nowa sprawa: Potrzeba.*${title}`, "u"),
  });
  await expect(item).toBeVisible();
  await item.click();
  await staff.waitForURL(new RegExp(`/admin/cases/${code}$`, "u"));
  await expect(
    staff.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();

  await staffContext.close();
  await authorContext.close();
});

test("„Użyj szkicu” wypełnia odpowiedź, a autor słyszy ją przez aria-live", async ({
  browser,
}, testInfo) => {
  const { staffContext, authorContext } = await contexts(browser, testInfo);
  const author = await authorContext.newPage();
  const { code, accessToken } = await createCase(
    author,
    `Test odpowiedzi ${Date.now()}`,
  );

  // The author keeps the case page open (it polls every 5 s).
  await author.goto(`/case/${code}?t=${encodeURIComponent(accessToken)}`);
  await expect(
    author.getByRole("heading", { name: "Rozmowa z Zespołem Hubu" }),
  ).toBeVisible();
  const live = author.locator(
    'section[aria-labelledby="thread-heading"] [aria-live="polite"]',
  );
  await expect(live).toBeEmpty();

  const staff = await staffContext.newPage();
  await staff.goto(`/api/demo-login?role=rops&next=/admin/cases/${code}`);
  await settle(staff);
  const draft = staff.locator("#triage-draft");
  await expect(draft).not.toHaveValue("", { timeout: 30_000 });
  const draftText = await draft.inputValue();
  await staff.getByRole("button", { name: "Użyj szkicu" }).click();
  const reply = staff.locator("#staff-reply");
  await expect(reply).toHaveValue(draftText);
  await expect(reply).toBeFocused();

  await staff.getByRole("button", { name: "Wyślij odpowiedź" }).click();
  await expect(
    staff.getByText("Odpowiedź jest w wątku", { exact: false }),
  ).toBeVisible();

  await expect(live).toHaveText(/Nowa odpowiedź od: Zespół Hubu ROPS/u, {
    timeout: 15_000,
  });
  await expect(author.getByText("Zespół Hubu ROPS").first()).toBeVisible();

  await staffContext.close();
  await authorContext.close();
});
