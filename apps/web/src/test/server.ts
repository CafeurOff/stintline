import type { Schema } from "@stintline/api-types";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import {
  circuits,
  consistency,
  headToHead,
  pitStops,
  sessionPace,
  teammates,
} from "./fixtures/analysis";
import { degradation } from "./fixtures/degradation";
import {
  decisions,
  documentDetail,
  documentEvents,
  documentList,
  documentSearch,
} from "./fixtures/paddock";
import { events } from "./fixtures/events";
import { homeResponse } from "./fixtures/home";
import { strategyResponse } from "./fixtures/strategy";
import {
  driver,
  driverResults,
  drivers,
  progression,
  sectors,
  standings,
  team,
  teams,
} from "./fixtures/hub";
import { model } from "./fixtures/model";
import { headlines, hungaryReport, sprintReport } from "./fixtures/news";
import { telemetryCompare, telemetryLaps } from "./fixtures/telemetry";
import { pitExit } from "./fixtures/pitExit";
import { pitLoss } from "./fixtures/pitLoss";
import { replay } from "./fixtures/replay";
import { session } from "./fixtures/session";
import { stints } from "./fixtures/stints";
import { track } from "./fixtures/track";
import { undercut } from "./fixtures/undercut";

export const healthyResponse: Schema<"Health"> = {
  status: "ok",
  version: "0.1.0",
  database: "ok",
};

/** The recorded demo session (Hungarian Grand Prix 2025). */
export const SESSION_ID = session.id;

export { homeResponse, strategyResponse };

export const seasonsResponse: Schema<"PaginatedSeasonList"> = {
  count: 1,
  next: null,
  previous: null,
  results: [{ year: 2025, events_count: events.count }],
};

/** Lap rows derived from the recorded replay (lap 1 excluded, as the engine does). */
export const lapsResponse: Schema<"Lap">[] = replay.cars.flatMap((car) =>
  car.line_times_s.flatMap((time, index) => {
    const before = index === 0 ? 0 : car.line_times_s[index - 1];
    if (time == null || before == null) return [];
    return [
      {
        car_number: car.car_number,
        lap: index + 1,
        time_s: time - before,
        corrected_time_s: null,
        compound: car.compounds[index] ?? "UNKNOWN",
        tyre_age: car.tyre_ages[index] ?? null,
        stint: null,
        is_pit_in: false,
        is_pit_out: false,
        race_time_s: time,
        excluded: index === 0 ? "first_lap" : null,
      },
    ];
  }),
);

export const offlineLive: Schema<"LiveStatus"> = {
  state: "offline",
  snapshot: null,
  next_session: {
    event_id: 14,
    event_name: "Hungarian Grand Prix",
    kind: "FP1",
    starts_at: "2026-11-06T15:30:00Z",
  },
};

export function problem(status: number, code: string, title: string, detail = title) {
  return HttpResponse.json(
    { type: "about:blank", title, status, detail, code } satisfies Schema<"Problem">,
    { status },
  );
}

export const handlers = [
  http.get("*/api/v1/health", () => HttpResponse.json(healthyResponse)),
  http.get("*/api/v1/seasons", () => HttpResponse.json(seasonsResponse)),
  http.get("*/api/v1/seasons/:year/events", () => HttpResponse.json(events)),
  http.get("*/api/v1/sessions/:id", ({ params }) =>
    Number(params.id) === SESSION_ID
      ? HttpResponse.json(session)
      : problem(404, "not_found", "Not found", "No session with this id."),
  ),
  http.get("*/api/v1/sessions/:id/stints", () => HttpResponse.json(stints)),
  http.get("*/api/v1/sessions/:id/track", () => HttpResponse.json(track)),
  http.get("*/api/v1/sessions/:id/replay", () => HttpResponse.json(replay)),
  http.get("*/api/v1/sessions/:id/sectors", () => HttpResponse.json(sectors)),
  http.get("*/api/v1/sessions/:id/laps", ({ request }) => {
    const cars = (new URL(request.url).searchParams.get("cars") ?? "").split(",").map(Number);
    return HttpResponse.json(lapsResponse.filter((lap) => cars.includes(lap.car_number)));
  }),
  http.get("*/api/v1/sessions/:id/pit-loss", () => HttpResponse.json(pitLoss)),
  http.get("*/api/v1/sessions/:id/degradation", () => HttpResponse.json(degradation)),
  http.post("*/api/v1/sessions/:id/simulate/undercut", () => HttpResponse.json(undercut)),
  http.post("*/api/v1/sessions/:id/simulate/pit-exit", () => HttpResponse.json(pitExit)),
  http.get("*/api/v1/model", () => HttpResponse.json(model)),
  http.get("*/api/v1/analysis/seasons/:year/teammates", () => HttpResponse.json(teammates)),
  http.get("*/api/v1/analysis/head-to-head", () => HttpResponse.json(headToHead)),
  http.get("*/api/v1/analysis/seasons/:year/consistency", () => HttpResponse.json(consistency)),
  http.get("*/api/v1/analysis/seasons/:year/pit-stops", () => HttpResponse.json(pitStops)),
  http.get("*/api/v1/analysis/circuits", () => HttpResponse.json(circuits)),
  http.get("*/api/v1/sessions/:id/pace", () => HttpResponse.json(sessionPace)),
  http.get("*/api/v1/documents/events", () => HttpResponse.json(documentEvents)),
  http.get("*/api/v1/documents", ({ request }) =>
    HttpResponse.json(new URL(request.url).searchParams.get("q") ? documentSearch : documentList),
  ),
  http.get("*/api/v1/documents/:id", () => HttpResponse.json(documentDetail)),
  http.get("*/api/v1/stewards/decisions", ({ request }) => {
    const driver = new URL(request.url).searchParams.get("driver");
    return HttpResponse.json(
      driver ? decisions.filter((d) => d.driver?.ref === driver) : decisions,
    );
  }),
  http.get("*/api/v1/live", () => HttpResponse.json(offlineLive)),
  http.get("*/api/v1/news/headlines", ({ request }) => {
    const lang = new URL(request.url).searchParams.get("lang");
    return HttpResponse.json(headlines.filter((h) => !lang || h.language === lang));
  }),
  http.get("*/api/v1/sessions/:id/telemetry", () => HttpResponse.json(telemetryLaps)),
  http.get("*/api/v1/sessions/:id/telemetry/compare", () => HttpResponse.json(telemetryCompare)),
  http.get("*/api/v1/news/reports", () => HttpResponse.json([hungaryReport, sprintReport])),
  http.get("*/api/v1/news/reports/:id", ({ params }) =>
    params.id === String(hungaryReport.session_id)
      ? HttpResponse.json(hungaryReport)
      : problem(404, "not_found", "Not found", "No report for this session."),
  ),
  http.post("*/api/v1/sessions/:id/simulate/strategy", async ({ request }) =>
    HttpResponse.json(strategyResponse((await request.json()) as Schema<"StrategyRequestRequest">)),
  ),
  http.get("*/api/v1/home", () => HttpResponse.json(homeResponse)),
  http.get("*/api/v1/events/:id", ({ params }) => {
    const event = events.results.find((e) => e.id === Number(params.id));
    return event ? HttpResponse.json(event) : problem(404, "not_found", "Not found");
  }),
  http.get("*/api/v1/drivers", () => HttpResponse.json(drivers)),
  http.get("*/api/v1/drivers/:ref", ({ params }) =>
    params.ref === driver.driver.ref
      ? HttpResponse.json(driver)
      : problem(404, "not_found", "Not found"),
  ),
  http.get("*/api/v1/drivers/:ref/results", () => HttpResponse.json(driverResults)),
  http.get("*/api/v1/teams", () => HttpResponse.json(teams)),
  http.get("*/api/v1/teams/:ref", ({ params }) =>
    params.ref === team.team.ref ? HttpResponse.json(team) : problem(404, "not_found", "Not found"),
  ),
  http.get("*/api/v1/seasons/:year/standings", () => HttpResponse.json(standings)),
  http.get("*/api/v1/seasons/:year/standings/progression", () => HttpResponse.json(progression)),
];

/** Shared MSW server. Unhandled requests fail the test: no network in tests. */
export const server = setupServer(...handlers);
