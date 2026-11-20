import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { headToHead, teammates } from "@/test/fixtures/analysis";
import { renderRoute } from "@/test/render";
import { problem, server } from "@/test/server";

describe("Head-to-head controls", () => {
  it("switches between teammates and two drivers, and picks drivers", async () => {
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
  });

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

  it("compares drivers of a season without lap timing", async () => {
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
  });
});
