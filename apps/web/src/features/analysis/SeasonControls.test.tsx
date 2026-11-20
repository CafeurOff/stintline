import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { pitStops } from "@/test/fixtures/analysis";
import { renderRoute } from "@/test/render";
import { problem, server } from "@/test/server";

describe("Circuits, consistency and pit stops controls", () => {
  it("sorts circuits by a figure and lists their records", async () => {
    const { router } = renderRoute("/circuits");

    expect(await screen.findByRole("region", { name: "Circuit records" })).toBeVisible();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "pitLoss");
    expect(router.state.location.search).toBe("?sort=pitLoss");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "calendar");
    expect(router.state.location.search).toBe("");
  });

  it("shows consistency and pit stops as empty before timing", async () => {
    server.use(
      http.get("*/api/v1/analysis/seasons/:year/pit-stops", () =>
        problem(404, "not_found", "No pit stops"),
      ),
    );
    renderRoute("/analysis/pit-stops");

    expect(await screen.findByText("Pit-stop data exists from 2023.")).toBeVisible();
  });

  it("explains consistency before timing", async () => {
    renderRoute("/analysis/consistency?season=1999");

    expect(
      await screen.findByText("Consistency needs lap timing, available from 2023."),
    ).toBeVisible();
  });

  it("reads in French", async () => {
    renderRoute("/circuits/suzuka", { locale: "fr" });

    expect(await screen.findByRole("region", { name: "Stratégies gagnantes" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Face aux autres circuits" })).toBeVisible();
  });

  it("sorts circuits by every figure", async () => {
    renderRoute("/circuits");

    const sort = await screen.findByRole("combobox", { name: "Sort by" });
    for (const value of ["degradation", "passes", "topSpeed", "throttle"]) {
      await userEvent.selectOptions(sort, value);
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
    }
  });

  it("falls back to pit-lane times in a season without stationary times", async () => {
    server.use(
      http.get("*/api/v1/analysis/seasons/:year/pit-stops", () =>
        HttpResponse.json({
          ...pitStops,
          fastest: [],
          undercut_attempts: 0,
          undercut_successes: 0,
          teams: pitStops.teams.map((t) => ({
            ...t,
            median_stationary_s: null,
            best_stationary_s: null,
          })),
          races: pitStops.races.map((r) => ({
            ...r,
            fastest: null,
            median_stationary_s: null,
            undercut_attempts: 0,
            pit_loss_reliable: false,
          })),
        }),
      ),
    );
    renderRoute("/analysis/pit-stops");

    expect(await screen.findByRole("region", { name: "Pit stops" })).toBeVisible();
    expect(screen.getAllByText(/No stationary times this season/)).not.toHaveLength(0);
  });
});
