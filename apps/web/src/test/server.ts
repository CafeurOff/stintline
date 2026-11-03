import type { Schema } from "@stintline/api-types";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { degradation } from "./fixtures/degradation";
import { events } from "./fixtures/events";
import { model } from "./fixtures/model";
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
  http.get("*/api/v1/sessions/:id/pit-loss", () => HttpResponse.json(pitLoss)),
  http.get("*/api/v1/sessions/:id/degradation", () => HttpResponse.json(degradation)),
  http.post("*/api/v1/sessions/:id/simulate/undercut", () => HttpResponse.json(undercut)),
  http.post("*/api/v1/sessions/:id/simulate/pit-exit", () => HttpResponse.json(pitExit)),
  http.get("*/api/v1/model", () => HttpResponse.json(model)),
];

/** Shared MSW server. Unhandled requests fail the test: no network in tests. */
export const server = setupServer(...handlers);
