import type { Schema } from "@stintline/api-types";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { session } from "@/test/fixtures/session";
import { renderRoute } from "@/test/render";
import { problem, server } from "@/test/server";

const QUALI_ID = 69;

function lap(
  n: number,
  start: number,
  time: number | null,
  extra: Partial<Schema<"TimelineLap">> = {},
) {
  return {
    lap: n,
    start_s: start,
    end_s: time === null ? null : start + time,
    drive_start_s: time === null ? null : start,
    drive_from: 0,
    time_s: time,
    sectors_s: [null, null, null],
    compound: "SOFT",
    tyre_age: n - 1,
    pit_out: false,
    pit_in: false,
    deleted: false,
    ...extra,
  };
}

/** Q1 from 0 to 1080 s (16 knocked out), Q2 from 1500 s. */
const timeline: Schema<"Timeline"> = {
  starts_at: "2025-08-02T14:00:00Z",
  duration_s: 3600,
  cars: [
    {
      car_number: 4,
      laps: [lap(1, 60, null, { pit_out: true }), lap(2, 150, 76.5), lap(3, 1600, 75.9)],
    },
    {
      car_number: 81,
      laps: [lap(1, 90, 80), lap(2, 170, 75.8, { deleted: true }), lap(3, 1620, 76.2)],
    },
    { car_number: 16, laps: [lap(1, 200, 77.9)] },
  ],
  segments: [
    { number: 1, start_s: 0, end_s: 1080, eliminated: [16] },
    { number: 2, start_s: 1500, end_s: 2400, eliminated: [] },
  ],
  flags: [{ status: "RED", start_s: 400, end_s: 600 }],
  race_control: [
    { at_s: 400, category: "Flag", flag: "RED", car_number: null, message: "RED FLAG" },
  ],
  weather: [
    {
      at_s: 0,
      air_temperature_c: 24.3,
      track_temperature_c: 41.2,
      rainfall: false,
      wind_speed_ms: 1.5,
    },
  ],
};

function useQualifying(data: Schema<"Timeline"> | null = timeline) {
  server.use(
    http.get("*/api/v1/sessions/:id", ({ params }) =>
      Number(params.id) === QUALI_ID
        ? HttpResponse.json({ ...session, id: QUALI_ID, kind: "Q" })
        : HttpResponse.json(session),
    ),
    http.get("*/api/v1/sessions/:id/timeline", () =>
      data ? HttpResponse.json(data) : problem(404, "not_found", "No lap timing"),
    ),
  );
}

function tower() {
  return screen.getByRole("region", { name: "Timing" });
}

async function shownTower() {
  return screen.findByRole("region", { name: "Timing" });
}

describe("SessionReplay", () => {
  it("shows the qualifying order as it stood, segment by segment", async () => {
    useQualifying();
    renderRoute(`/sessions/${String(QUALI_ID)}?t=900`);

    expect(
      await screen.findByRole("heading", { name: "Hungarian Grand Prix 2025: Qualifying" }),
    ).toBeVisible();
    const rows = within(await shownTower()).getAllByRole("button");
    // At 15:00 in Q1: NOR 1:16.500, PIA's 1:15.800 was deleted so his 1:20.000 counts.
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "1. Lando Norris, 1:16.500",
      "2. Charles Leclerc, 1:17.900",
      "3. Oscar Piastri, 1:20.000",
    ]);
    expect(screen.getAllByText("Q1")).toHaveLength(2); // the segment pill and the strip
    expect(screen.getByText("RED FLAG")).toBeVisible();
    expect(screen.getByText("24.3 °C")).toBeVisible();
  });

  it("resets times in Q2 and keeps the knocked-out driver at the bottom", async () => {
    useQualifying();
    renderRoute(`/sessions/${String(QUALI_ID)}?t=1800`);

    const rows = within(await shownTower()).getAllByRole("button");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "1. Lando Norris, 1:15.900",
      "2. Oscar Piastri, 1:16.200",
      "3. Charles Leclerc, 1:17.900",
    ]);
    expect(within(tower()).getByText("Out in Q1")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Simulate the stop" })).toBeNull();
  });

  it("lists the followed driver's laps with out laps and deleted times", async () => {
    useQualifying();
    renderRoute(`/sessions/${String(QUALI_ID)}?t=900&car=81`);

    const panel = await screen.findByRole("complementary");
    expect(await within(panel).findByText("Oscar Piastri")).toBeVisible();
    expect(within(panel).getByText("Deleted")).toBeVisible();
    expect(within(panel).getByText("In the pits")).toBeVisible();

    await userEvent.click(within(tower()).getByRole("button", { name: /Lando Norris/ }));
    expect(await within(panel).findByText("Out lap")).toBeVisible();
  });

  it("links the weekend's sessions and marks the ones not ready", async () => {
    useQualifying();
    renderRoute(`/sessions/${String(QUALI_ID)}?t=900`);

    const nav = await screen.findByRole("navigation", { name: "Sessions of the weekend" });
    expect(within(nav).getByRole("link", { name: "Race" })).toHaveAttribute("href", "/sessions/70");
    expect(within(nav).queryByRole("link", { name: /FP1/ })).toBeNull();
    expect(within(nav).getAllByText("(Being imported)", { exact: false })).toHaveLength(3);
  });

  it("says when a session has no timing yet", async () => {
    useQualifying(null);
    renderRoute(`/sessions/${String(QUALI_ID)}`);

    expect(await screen.findByText(/has no lap timing yet/)).toBeVisible();
  });
});
