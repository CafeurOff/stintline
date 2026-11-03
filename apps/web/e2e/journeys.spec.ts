import { expect, test } from "@playwright/test";

import { mockApi, SESSION_ID } from "./mockApi";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("pick a race and read its tyre strategy", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Hungarian Grand Prix: Race strategy" }).click();

  await expect(page).toHaveURL(`/sessions/${SESSION_ID}`);
  await expect(page.getByRole("heading", { name: "Hungarian Grand Prix" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Stint timeline: 20 drivers/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Podium" })).toContainText("Lando Norris");
  // Official media are blocked in tests: the original car illustration takes over.
  await expect(page.getByRole("img", { name: "McLaren car" }).first()).toBeVisible();
});

test("move the undercut slider and get a new simulation", async ({ page }) => {
  await page.goto(`/sessions/${SESSION_ID}/simulator`);
  const card = page.getByRole("region", { name: "Undercut / overcut" });
  await expect(card.getByText("The undercut fails")).toBeVisible();

  const slider = card.getByRole("slider", { name: "Attacker's stop lap" });
  await slider.focus();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowRight");

  await expect(slider).toHaveAttribute("aria-valuetext", "Lap 26 of 70");
  await expect(page).toHaveURL(/stop=26/);
  await expect(card.getByRole("img", { name: /lap 26/ })).toBeVisible();
});

test("read the model assumptions and backtest", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Model" }).click();

  await expect(page.getByRole("heading", { name: "How StintLine predicts" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Held-out races" })).toContainText("0.86 pos");
  await expect(page.getByRole("region", { name: "Lap cleaning" })).toContainText("outlier_k");
});

test("switch to the light theme and keep it after a reload", async ({ page }) => {
  await page.goto("/model");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
