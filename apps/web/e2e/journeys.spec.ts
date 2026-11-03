import { expect, test } from "@playwright/test";

import { mockApi, SESSION_ID } from "./mockApi";

test.use({ locale: "en-GB", reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("open the last race from home and see where a driver rejoins after a stop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Replay it on the circuit" }).click();

  await expect(page).toHaveURL(`/sessions/${SESSION_ID}`);
  const map = page.getByRole("group", { name: /Hungaroring: cars on track/ });
  await expect(map.getByRole("button")).toHaveCount(20);

  await page.getByRole("slider", { name: "Lap" }).fill("30");
  await page.getByRole("button", { name: "Simulate the stop" }).click();

  const panel = page.getByRole("complementary");
  await expect(panel.getByText("5th at the pit exit")).toBeVisible();
  await expect(panel.getByText(/rejoin between ALO/)).toBeVisible();
});

test("pick a driver on the map and simulate an undercut", async ({ page }) => {
  await page.goto(`/sessions/${SESSION_ID}?lap=30`);

  await page
    .getByRole("group", { name: /cars on track/ })
    .getByRole("button", { name: "Oscar Piastri" })
    .click();
  await page.getByText("Undercut", { exact: true }).click();
  const panel = page.getByRole("complementary");
  await expect(panel.getByText("Can Oscar Piastri undercut Charles Leclerc?")).toBeVisible();

  await panel.getByRole("button", { name: "Simulate the undercut" }).click();

  await expect(panel.getByText(/PIA would (stay behind|come out ahead)/)).toBeVisible();
  await expect(page).toHaveURL(/car=81/);
});

test("read the tyres page and the explanation in French", async ({ page }) => {
  await page.goto(`/sessions/${SESSION_ID}`);

  await page.getByRole("button", { name: "fr", exact: true }).click();
  await page.getByRole("link", { name: "Pneus" }).click();
  await expect(page.getByText("Durs")).toBeVisible();

  await page.getByRole("link", { name: "Comment ça marche" }).click();
  await expect(page.getByRole("heading", { name: "Comment fonctionne StintLine" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("switch to the light theme and keep it after a reload", async ({ page }) => {
  await page.goto("/model");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("find a driver and read their career", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Drivers" })
    .click();
  await expect(page).toHaveURL("/drivers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/drivers/i);
  await page
    .getByRole("main")
    .getByRole("link", { name: /Norris/ })
    .click();

  await expect(page.getByRole("heading", { name: "Norris" })).toBeVisible();
  await expect(page.getByLabel("Career in numbers")).toContainText("Titles");
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
});
