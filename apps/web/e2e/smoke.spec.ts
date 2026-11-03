import { expect, test } from "@playwright/test";

import { mockApi } from "./mockApi";

test.use({ locale: "en-GB", reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("the explanation page loads with the server status and disclaimer", async ({ page }) => {
  await page.goto("/model");

  await expect(page).toHaveTitle("StintLine");
  await expect(page.getByText("Server online · v0.1.0")).toBeVisible();
  await expect(page.getByText(/not associated with Formula 1/)).toBeVisible();
});

test("keyboard users can skip to the main content", async ({ page }) => {
  await page.goto("/model");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("unknown routes show the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
