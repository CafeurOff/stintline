import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { title } from "@/test/fixtures/title";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("Title maths", () => {
  it("shows the champion, the round it was settled and how far each driver could go", async () => {
    renderRoute("/standings/2025");

    const panel = await screen.findByRole("region", { name: "Title maths" });
    expect(
      await within(panel).findByText(/Norris was champion after round 24, Abu Dhabi Grand Prix/),
    ).toBeVisible();
    const bars = within(panel).getByRole("list", { name: /most each driver can still reach/ });
    expect(within(bars).getAllByRole("listitem")).toHaveLength(3);
    expect(within(bars).getByText("Champion")).toBeVisible();
    expect(within(bars).getAllByText("Out of reach")).toHaveLength(2);
  });

  it("says what the leader needs at the next Grand Prix, in French", async () => {
    server.use(
      http.get("*/api/v1/seasons/:year/title", () =>
        HttpResponse.json({
          ...title,
          decided: null,
          races_left: 2,
          races_done: 22,
          points_left: 58,
          next_round: {
            round: 23,
            event_id: 23,
            name: "Qatar Grand Prix",
            race_date: "2025-11-30",
            sprint: true,
          },
          drivers: title.drivers.map((row, index) => ({
            ...row,
            status: index === 0 ? "leader" : index < 3 ? "contender" : "out",
            clinch_margin: index === 1 ? 9 : index === 2 ? -3 : index === 0 ? null : null,
            ceiling: row.points + 58,
          })),
        }),
      ),
    );
    renderRoute("/standings/2025", { locale: "fr" });

    const panel = await screen.findByRole("region", { name: "Calcul du titre" });
    expect(
      await within(panel).findByText(/Norris est champion au Grand Prix du Qatar s'il/),
    ).toBeVisible();
    expect(within(panel).getByText("marque plus de 9 points de plus que Verstappen")).toBeVisible();
    expect(within(panel).getByText("ne perd pas 3 points ou plus face à Piastri")).toBeVisible();
    expect(within(panel).getAllByText("Encore en course")).toHaveLength(2);
  });

  it("counts the drivers still in an open fight, with the sprints left", async () => {
    server.use(
      http.get("*/api/v1/seasons/:year/title", () =>
        HttpResponse.json({
          ...title,
          decided: null,
          next_round: null,
          races_left: 6,
          sprints_left: 2,
          points_left: 166,
          drivers: title.drivers.map((row, index) => ({
            ...row,
            status: index === 0 ? "leader" : "contender",
            ceiling: row.points + 166,
          })),
        }),
      ),
    );
    renderRoute("/standings/2025");

    expect(
      await screen.findByText(
        /6 drivers can still be champion, with 6 Grands Prix left: up to 166 points/,
      ),
    ).toBeVisible();
    expect(screen.getByText(/Plus 2 sprints/)).toBeVisible();
  });

  it("puts the champion on the home page's leader tile", async () => {
    renderRoute("/");

    expect(await screen.findByText(/Norris was champion after round 24/)).toBeVisible();
  });

  it("handles one race to spare, a level margin and dropped results", async () => {
    server.use(
      http.get("*/api/v1/seasons/:year/title", () =>
        HttpResponse.json({
          ...title,
          rules: { ...title.rules, all_count: false },
          decided: { ...title.decided, round: 23 },
          races_done: 24,
          drivers: title.drivers.map((row, index) => ({
            ...row,
            scored: index === 0 ? row.points + 4.5 : row.points,
          })),
        }),
      ),
    );
    renderRoute("/standings/2025");

    expect(await screen.findByText("With one Grand Prix to spare.")).toBeVisible();
    expect(screen.getByText(/427\.5 scored/)).toBeVisible();
    expect(screen.getByText(/Only a driver's best results counted/)).toBeVisible();
  });

  it("asks the leader simply to outscore a rival, with one sprint left", async () => {
    server.use(
      http.get("*/api/v1/seasons/:year/title", () =>
        HttpResponse.json({
          ...title,
          decided: null,
          races_left: 1,
          sprints_left: 1,
          next_round: { ...title.decided, round: 24 },
          drivers: title.drivers.map((row, index) => ({
            ...row,
            status: index === 0 ? "leader" : index === 1 ? "contender" : "out",
            clinch_margin: index === 1 ? 0 : null,
          })),
        }),
      ),
    );
    renderRoute("/standings/2025");

    expect(await screen.findByText("outscores Verstappen")).toBeVisible();
  });

  it("shows an open fight's single sprint left", async () => {
    server.use(
      http.get("*/api/v1/seasons/:year/title", () =>
        HttpResponse.json({
          ...title,
          decided: null,
          next_round: null,
          races_left: 3,
          sprints_left: 1,
          drivers: title.drivers.map((row, index) => ({
            ...row,
            status: index === 0 ? "leader" : index === 1 ? "contender" : "out",
          })),
        }),
      ),
    );
    renderRoute("/standings/2025");

    expect(await screen.findByText(/Plus one sprint\./)).toBeVisible();
  });
});
