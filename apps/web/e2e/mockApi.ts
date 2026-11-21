import type { Page } from "@playwright/test";

import { degradation } from "../src/test/fixtures/degradation";
import { circuits } from "../src/test/fixtures/analysis";
import { events } from "../src/test/fixtures/events";
import { homeResponse } from "../src/test/fixtures/home";
import {
  driver,
  driverForm,
  driverResults,
  drivers,
  progression,
  sectors,
  standings,
} from "../src/test/fixtures/hub";
import { lapsResponse } from "../src/test/fixtures/laps";
import { offlineLive } from "../src/test/fixtures/live";
import { model } from "../src/test/fixtures/model";
import { headlines, hungaryReport } from "../src/test/fixtures/news";
import { decisions } from "../src/test/fixtures/paddock";
import { pitExit } from "../src/test/fixtures/pitExit";
import { pitLoss } from "../src/test/fixtures/pitLoss";
import { replay } from "../src/test/fixtures/replay";
import { session } from "../src/test/fixtures/session";
import { stints } from "../src/test/fixtures/stints";
import { strategyResponse, type StrategyRequest } from "../src/test/fixtures/strategy";
import { title } from "../src/test/fixtures/title";
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
  await page.route("https://images.example.org/**", (route) => route.abort());
  const json = (body: unknown) => ({ json: body });
  const seasons = {
    count: 1,
    next: null,
    previous: null,
    results: [{ year: 2025, events_count: 4 }],
  };
  const routes: [string, unknown][] = [
    ["**/api/v1/health", { status: "ok", version: "0.1.0", database: "ok" }],
    ["**/api/v1/seasons", seasons],
    ["**/api/v1/seasons?*", seasons],
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
    ["**/api/v1/forecasts*", []],
    ["**/api/v1/drivers?*", drivers],
    ["**/api/v1/drivers/norris", driver],
    ["**/api/v1/drivers/norris/results*", driverResults],
    ["**/api/v1/drivers/norris/form", driverForm],
    ["**/api/v1/seasons/2025/standings", standings],
    ["**/api/v1/seasons/2025/standings?*", standings],
    ["**/api/v1/seasons/2025/standings/progression", progression],
    ["**/api/v1/seasons/2025/title", title],
    ["**/api/v1/live", offlineLive],
    ["**/api/v1/analysis/circuits*", circuits],
    ["**/api/v1/stewards/decisions*", decisions],
  ];
  for (const [pattern, body] of routes) {
    await page.route(pattern, (route) => route.fulfill(json(body)));
  }
  // The Grand Prix page of the recorded race and its lap charts.
  const event = events.results.find((e) => e.sessions.some((s) => s.id === SESSION_ID));
  if (event) {
    await page.route(`**/api/v1/events/${String(event.id)}`, (route) => route.fulfill(json(event)));
  }
  await page.route(`**/api/v1/sessions/${SESSION_ID}/sectors*`, (route) =>
    route.fulfill(json(sectors)),
  );
  await page.route(`**/api/v1/sessions/${SESSION_ID}/laps*`, (route) => {
    const cars = (new URL(route.request().url()).searchParams.get("cars") ?? "")
      .split(",")
      .map(Number);
    return route.fulfill(json(lapsResponse.filter((lap) => cars.includes(lap.car_number))));
  });
  await page.route(`**/api/v1/sessions/${SESSION_ID}/simulate/pit-exit`, (route) =>
    route.fulfill(json(pitExit)),
  );
  await page.route(`**/api/v1/sessions/${SESSION_ID}/simulate/strategy`, (route) =>
    route.fulfill(json(strategyResponse(route.request().postDataJSON() as StrategyRequest))),
  );
  await page.route("**/api/v1/news/headlines*", (route) => {
    const lang = new URL(route.request().url()).searchParams.get("lang");
    return route.fulfill(json(headlines.filter((h) => !lang || h.language === lang)));
  });
  await page.route("**/api/v1/news/reports/*", (route) =>
    route
      .request()
      .url()
      .endsWith(`/${String(hungaryReport.session_id)}`)
      ? route.fulfill(json(hungaryReport))
      : route.fulfill({ status: 404, json: { detail: "No report for this session." } }),
  );
  /** The undercut echoes the requested stop lap so a test can see the slider take effect. */
  await page.route(`**/api/v1/sessions/${SESSION_ID}/simulate/undercut`, (route) => {
    const body = route.request().postDataJSON() as { stop_lap: number };
    const lapGaps = undercut.lap_gaps.map((gap, index) => ({ ...gap, lap: body.stop_lap + index }));
    return route.fulfill(json({ ...undercut, lap_gaps: lapGaps }));
  });
}
