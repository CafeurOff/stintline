import type { Page } from "@playwright/test";

import { degradation } from "../src/test/fixtures/degradation";
import { events } from "../src/test/fixtures/events";
import { homeResponse } from "../src/test/fixtures/home";
import { driver, driverResults, drivers } from "../src/test/fixtures/hub";
import { model } from "../src/test/fixtures/model";
import { pitExit } from "../src/test/fixtures/pitExit";
import { pitLoss } from "../src/test/fixtures/pitLoss";
import { replay } from "../src/test/fixtures/replay";
import { session } from "../src/test/fixtures/session";
import { stints } from "../src/test/fixtures/stints";
import { track } from "../src/test/fixtures/track";
import { undercut } from "../src/test/fixtures/undercut";

export const SESSION_ID = session.id;

/**
 * Serves the recorded demo API to the browser so journeys run without a backend.
 * Official media and Wikimedia URLs are aborted: tests never reach the network, and the UI must fall back
 * to its original illustrations.
 */
export async function mockApi(page: Page) {
  await page.route("https://media.formula1.com/**", (route) => route.abort());
  await page.route("https://*.wikimedia.org/**", (route) => route.abort());
  const json = (body: unknown) => ({ json: body });
  const routes: [string, unknown][] = [
    ["**/api/v1/health", { status: "ok", version: "0.1.0", database: "ok" }],
    [
      "**/api/v1/seasons",
      { count: 1, next: null, previous: null, results: [{ year: 2025, events_count: 4 }] },
    ],
    [
      "**/api/v1/seasons/2025/events*",
      { ...events, results: events.results.filter((e) => e.round <= 14) },
    ],
    [`**/api/v1/sessions/${SESSION_ID}`, session],
    [`**/api/v1/sessions/${SESSION_ID}/stints`, stints],
    [`**/api/v1/sessions/${SESSION_ID}/pit-loss`, pitLoss],
    [`**/api/v1/sessions/${SESSION_ID}/degradation`, degradation],
    [`**/api/v1/sessions/${SESSION_ID}/track`, track],
    [`**/api/v1/sessions/${SESSION_ID}/replay`, replay],
    ["**/api/v1/model", model],
    ["**/api/v1/home", homeResponse],
    ["**/api/v1/drivers?*", drivers],
    ["**/api/v1/drivers/norris", driver],
    ["**/api/v1/drivers/norris/results*", driverResults],
  ];
  for (const [pattern, body] of routes) {
    await page.route(pattern, (route) => route.fulfill(json(body)));
  }
  await page.route(`**/api/v1/sessions/${SESSION_ID}/simulate/pit-exit`, (route) =>
    route.fulfill(json(pitExit)),
  );
  /** The undercut echoes the requested stop lap so a test can see the slider take effect. */
  await page.route(`**/api/v1/sessions/${SESSION_ID}/simulate/undercut`, (route) => {
    const body = route.request().postDataJSON() as { stop_lap: number };
    const lapGaps = undercut.lap_gaps.map((gap, index) => ({ ...gap, lap: body.stop_lap + index }));
    return route.fulfill(json({ ...undercut, lap_gaps: lapGaps }));
  });
}
