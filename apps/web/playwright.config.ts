import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * End-to-end journeys. The API is mocked per test with `page.route`, so these run
 * without a backend.
 */
export default defineConfig({
  testDir: "./e2e",
  // Screenshots for pull requests, not journeys: `pnpm shots` (playwright.shots.config.ts).
  testIgnore: "shots/**",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
