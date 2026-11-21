import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { test, type Page } from "@playwright/test";

import { mockApi } from "../mockApi";

/**
 * Full-page screenshots of app routes and of standalone HTML mock-ups, on desktop and phone,
 * in the dark (default) and light themes. Mock-ups are shot once, in the first theme.
 *
 *   SHOTS_ROUTES="/,/drivers/norris"   app paths, comma separated
 *   SHOTS_HTML="/abs/mock.html"         mock-up files, comma separated (optional)
 *   SHOTS_THEMES="dark,light"           default: dark
 *   SHOTS_OUT=/abs/dir                  default: apps/web/shots-out (git-ignored)
 *   SHOTS_PREFIX=after                  file name prefix, e.g. before / after / mockup
 */
const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const routes = list(process.env.SHOTS_ROUTES);
const mockups = list(process.env.SHOTS_HTML);
const themes = list(process.env.SHOTS_THEMES ?? "dark");
const out = resolve(process.env.SHOTS_OUT ?? "shots-out");
const prefix = process.env.SHOTS_PREFIX ?? "shot";
const viewports = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
} as const;

mkdirSync(out, { recursive: true });
test.use({ locale: "en-GB", reducedMotion: "reduce" });

const slug = (path: string) =>
  path.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "home";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Charts and lazy pages draw after the data arrives.
  await page.waitForTimeout(800);
}

for (const theme of themes) {
  for (const [device, viewport] of Object.entries(viewports)) {
    for (const route of routes) {
      test(`${prefix} ${route} ${device} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.addInitScript((value) => {
          localStorage.setItem("stintline-theme", value);
        }, theme);
        await mockApi(page);
        await page.goto(route);
        await settle(page);
        await page.screenshot({
          path: `${out}/${prefix}-${slug(route)}-${device}-${theme}.png`,
          fullPage: true,
        });
      });
    }
    // A mock-up has no theme toggle: shoot it once.
    for (const file of theme === themes[0] ? mockups : []) {
      test(`${prefix} ${file} ${device} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(pathToFileURL(resolve(file)).href);
        await settle(page);
        await page.screenshot({
          path: `${out}/${prefix}-${slug(basename(file, ".html"))}-${device}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }
}
