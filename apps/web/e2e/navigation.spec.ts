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
  const constructors = page.getByText("Constructors", { exact: true }).first();
  // Scroll a little, keeping the switch on screen: a click on a control out of view would
  // scroll it back into view, whatever the page does.
  await page.mouse.wheel(0, 150);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(20);
  await expect(constructors).toBeInViewport();
  const before = await scrollY(page);

  await constructors.click();

  await expect(page).toHaveURL(/table=constructors/);
  expect(await scrollY(page)).toBe(before);
});

test("reduce the sidebar to icons and find it reduced after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reduce the menu" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-rail", "collapsed");

  await page.locator('#site-rail a[href="/standings"]').hover();
  await expect(page.getByText("Standings", { exact: true }).last()).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-rail", "collapsed");
  await page.keyboard.press("[");
  await expect(page.locator("html")).not.toHaveAttribute("data-rail", "collapsed");
});

test("share a chart: copy its link, save it as a picture and its data as CSV", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/events/14?chart=positions");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The race analysis loads its own chunks after the page: slower on CI runners.
  const save = page.getByRole("button", { name: "Save the chart as a picture" }).first();
  await expect(save).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Copy the link to this view" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
  expect(await page.evaluate<string>("navigator.clipboard.readText()")).toContain(
    "chart=positions",
  );

  const picture = page.waitForEvent("download");
  await save.click();
  expect((await picture).suggestedFilename()).toMatch(/\.png$/);

  const data = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the data (CSV)" }).first().click();
  expect((await data).suggestedFilename()).toMatch(/\.csv$/);
});
