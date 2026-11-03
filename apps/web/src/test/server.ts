import type { Schema } from "@stintline/api-types";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const healthyResponse: Schema<"Health"> = {
  status: "ok",
  version: "0.1.0",
  database: "ok",
};

export const handlers = [http.get("*/api/v1/health", () => HttpResponse.json(healthyResponse))];

/** Shared MSW server. Unhandled requests fail the test: no network in tests. */
export const server = setupServer(...handlers);
