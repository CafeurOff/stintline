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
import { events } from "./fixtures/events";
import { forecasts } from "./fixtures/forecast";
import { homeResponse } from "./fixtures/home";
import {
  driver,
  driverForm,
  driverResults,
  drivers,
  progression,
  sectors,
  standings,
  team,
  teams,
} from "./fixtures/hub";
import { lapsResponse } from "./fixtures/laps";
import { offlineLive } from "./fixtures/live";
import { model } from "./fixtures/model";
import { headlines, hungaryReport, sprintReport } from "./fixtures/news";
import {
  decisions,
  documentDetail,
  documentEvents,
  documentList,
  documentSearch,
} from "./fixtures/paddock";
import { pitExit } from "./fixtures/pitExit";
import { pitLoss } from "./fixtures/pitLoss";
import { replay } from "./fixtures/replay";
import { session } from "./fixtures/session";
import { stints } from "./fixtures/stints";
import { strategyResponse } from "./fixtures/strategy";
import { incidents, powerUnits, upgrades } from "./fixtures/technical";
import { telemetryCompare, telemetryLaps } from "./fixtures/telemetry";
import { title } from "./fixtures/title";
import { track } from "./fixtures/track";
import { undercut } from "./fixtures/undercut";

const healthyResponse: Schema<"Health"> = {
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

export function problem(status: number, code: string, title: string, detail = title) {
  return HttpResponse.json(
    { type: "about:blank", title, status, detail, code } satisfies Schema<"Problem">,
    { status },
  );
}

const handlers = [
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
  http.get("*/api/v1/technical/upgrades", () => HttpResponse.json(upgrades)),
  http.get("*/api/v1/technical/power-units", () => HttpResponse.json(powerUnits)),
  http.get("*/api/v1/technical/incidents", () => HttpResponse.json(incidents)),
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
  http.get("*/api/v1/forecasts", ({ request }) => {
    const event = new URL(request.url).searchParams.get("event");
    return HttpResponse.json(forecasts.filter((f) => !event || f.event_id === Number(event)));
  }),
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
  http.get("*/api/v1/drivers/:ref/form", () => HttpResponse.json(driverForm)),
  http.get("*/api/v1/teams", () => HttpResponse.json(teams)),
  http.get("*/api/v1/teams/:ref", ({ params }) =>
    params.ref === team.team.ref ? HttpResponse.json(team) : problem(404, "not_found", "Not found"),
  ),
  http.get("*/api/v1/seasons/:year/standings", () => HttpResponse.json(standings)),
  http.get("*/api/v1/seasons/:year/standings/progression", () => HttpResponse.json(progression)),
  http.get("*/api/v1/seasons/:year/title", () => HttpResponse.json(title)),
];

/** Shared MSW server. Unhandled requests fail the test: no network in tests. */
export const server = setupServer(...handlers);
