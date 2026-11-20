import { expect, type Page, test } from "@playwright/test";

import { mockApi } from "./mockApi";

/** The page scroll position (the e2e project has no DOM types). */
const scrollY = (page: Page) => page.evaluate<number>("window.scrollY");

test.use({ locale: "en-GB", reducedMotion: "reduce", viewport: { width: 1400, height: 700 } });

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("a new page opens at the top and going back returns to where the reader was", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.mouse.wheel(0, 1200);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(400);
  const before = await scrollY(page);

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Standings" })
    .click();
  await expect(page).toHaveURL(/\/standings/);
  await expect.poll(() => scrollY(page)).toBe(0);
  await expect(page.locator("main")).toBeFocused();

  await page.goBack();
  await expect.poll(() => scrollY(page)).toBe(before);
});

test("changing a filter keeps the reader where they are", async ({ page }) => {
  await page.goto("/standings");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.mouse.wheel(0, 300);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(20);
  const before = await scrollY(page);

  await page.getByText("Constructors", { exact: true }).first().click();

  await expect(page).toHaveURL(/table=constructors/);
  expect(await scrollY(page)).toBe(before);
});
