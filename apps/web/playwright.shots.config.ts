import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.SHOTS_PORT ?? 4174);

/**
 * Screenshots for pull requests and design proposals, not tests: `pnpm --filter web shots`.
 * Pages are served by the production build with the recorded demo API (`e2e/mockApi.ts`),
 * so they need no backend and never reach the network. See `e2e/shots/shots.spec.ts`.
 */
export default defineConfig({
  testDir: "./e2e/shots",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
