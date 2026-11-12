import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { headToHead, pitStops, teammates } from "@/test/fixtures/analysis";
import { problem, server } from "@/test/server";

/** Several clicks on a page with charts: slower than one query under coverage. */
const SLOW_MS = 15_000;

describe("Analysis page controls", () => {
  it(
    "applies every pace filter to the URL",
    async () => {
      const { router } = renderRoute("/analysis/pace");

      expect(await screen.findByRole("heading", { name: /^Race pace: / })).toBeVisible();
      const pit = screen.getByRole("group", { name: "Pit laps" });
      await userEvent.click(within(pit).getByRole("radio", { name: "Show" }));
      const sc = screen.getByRole("group", { name: "Safety-car laps" });
      await userEvent.click(within(sc).getByRole("radio", { name: "Show" }));
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "Cut-off" }), "0");

      const search = router.state.location.search;
      expect(search).toContain("pit=1");
      expect(search).toContain("sc=1");
      expect(search).toContain("cutoff=0");

      await userEvent.click(within(sc).getByRole("radio", { name: "Hide" }));
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "Cut-off" }), "107");
      expect(router.state.location.search).not.toContain("cutoff");
      expect(router.state.location.search).not.toContain("sc=");
    },
    SLOW_MS,
  );

  it(
    "picks the drivers drawn on the pace charts",
    async () => {
      const { router } = renderRoute("/analysis/pace?session=70");

      const ranking = await screen.findByRole("table", { name: "Pace ranking" });
      const boxes = within(ranking).getAllByRole("checkbox");
      const unticked = boxes.find((box) => !(box as HTMLInputElement).checked);
      const ticked = boxes.find((box) => (box as HTMLInputElement).checked);
      if (!ticked || !unticked) throw new Error("expected ticked and unticked drivers");

      await userEvent.click(ticked);
      await userEvent.click(unticked);

      expect(router.state.location.search).toContain("drivers=");
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "Race" }), "70");
      expect(router.state.location.search).toContain("session=70");
    },
    SLOW_MS,
  );

  it("explains that pace needs timing before 2023", async () => {
    renderRoute("/analysis/pace?season=2010");

    expect(await screen.findByText("Lap timing exists from 2023.")).toBeVisible();
  });

  it(
    "switches between teammates and two drivers, and picks drivers",
    async () => {
      const { router } = renderRoute("/analysis");

      await userEvent.click(await screen.findByRole("radio", { name: "Two drivers" }));
      expect(router.state.location.search).toContain("mode=drivers");
      expect(await screen.findByRole("heading", { name: "NOR vs PIA, 2025" })).toBeVisible();

      await userEvent.selectOptions(screen.getByRole("combobox", { name: "against" }), "hamilton");
      expect(router.state.location.search).toContain("b=hamilton");
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "Driver" }), "hamilton");
      expect(await screen.findByText("Pick two different drivers.")).toBeVisible();

      await userEvent.click(screen.getByRole("radio", { name: "Teammates" }));
      expect(router.state.location.search).not.toContain("mode=");
    },
    SLOW_MS,
  );

  it("changes the season of the duels", async () => {
    const { router } = renderRoute("/analysis");

    await screen.findByRole("region", { name: "McLaren" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Season" }), "2025");

    expect(router.state.location.search).not.toContain("season=");
  });

  it("says when two drivers did not race together", async () => {
    server.use(
      http.get("*/api/v1/analysis/head-to-head", () =>
        problem(404, "not_found", "Both drivers must have started a race that season."),
      ),
    );
    renderRoute("/analysis?mode=drivers&a=norris&b=fangio");

    expect(
      await screen.findByText("These two drivers did not both race that season."),
    ).toBeVisible();
  });

  it("offers a retry when the duels fail to load", async () => {
    server.use(
      http.get("*/api/v1/analysis/seasons/:year/teammates", () =>
        problem(500, "error", "Server error"),
      ),
    );
    renderRoute("/analysis");

    expect(await screen.findByRole("button", { name: /retry/i })).toBeVisible();
  });

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

  it(
    "sorts circuits by every figure",
    async () => {
      renderRoute("/circuits");

      const sort = await screen.findByRole("combobox", { name: "Sort by" });
      for (const value of ["degradation", "passes", "topSpeed", "throttle"]) {
        await userEvent.selectOptions(sort, value);
        expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
      }
    },
    SLOW_MS,
  );

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

  it(
    "compares drivers of a season without lap timing",
    async () => {
      const untimed = (r: (typeof headToHead.rounds)[number]) => ({
        ...r,
        session_id: null,
        pace_gap_s: null,
      });
      server.use(
        http.get("*/api/v1/analysis/head-to-head", () =>
          HttpResponse.json({
            ...headToHead,
            season: 1988,
            pace: [0, 0],
            median_pace_gap_s: null,
            rounds: headToHead.rounds.map(untimed),
          }),
        ),
        http.get("*/api/v1/analysis/seasons/:year/teammates", () =>
          HttpResponse.json(
            teammates.map((d) => ({
              ...d,
              pace: [0, 0],
              median_pace_gap_s: null,
              median_quali_gap_s: null,
              rounds: d.rounds.map(untimed),
            })),
          ),
        ),
      );
      renderRoute("/analysis?season=1988");

      expect(await screen.findByRole("region", { name: "Biggest points gap" })).toBeVisible();
      await userEvent.click(screen.getByRole("radio", { name: "Two drivers" }));
      expect(await screen.findByText(/Race pace needs lap timing/)).toBeVisible();
    },
    SLOW_MS,
  );
});
