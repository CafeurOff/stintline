import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/health", (route) =>
    route.fulfill({ json: { status: "ok", version: "0.1.0", database: "ok" } }),
  );
});

test("home page loads with title, API status and disclaimer", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("StintLine");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Race strategy, lap by lap.");
  await expect(page.getByRole("status")).toHaveText("API online · v0.1.0");
  await expect(page.getByText(/not associated with Formula 1/)).toBeVisible();
});

test("keyboard users can skip to the main content", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("unknown routes show the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
