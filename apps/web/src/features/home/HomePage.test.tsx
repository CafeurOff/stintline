import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { hungaryReport } from "@/test/fixtures/news";
import { homeResponse, server } from "@/test/server";

describe("Home page", () => {
  it("leads with the last Grand Prix, its podium and a replay", async () => {
    renderRoute("/");

    const hero = await screen.findByRole("region", { name: "Hungarian Grand Prix" });
    expect(within(hero).getByText(/Lando Norris wins for McLaren/)).toBeVisible();
    const podium = within(hero).getByRole("list", { name: "Podium" });
    expect(within(podium).getAllByRole("link")).toHaveLength(3);
    expect(within(hero).getByRole("link", { name: /Replay it on the circuit/ })).toBeVisible();
  });

  it("counts down to the next session of the next Grand Prix", async () => {
    renderRoute("/");

    const next = await screen.findByRole("region", { name: /Italian Grand Prix/ });
    expect(within(next).getByRole("timer")).toBeVisible();
  });

  it("sums up the last race in key figures and facts", async () => {
    renderRoute("/");

    expect(await screen.findByRole("region", { name: "Biggest climber" })).toBeVisible();
    const facts = await screen.findByRole("region", { name: "Last race in facts" });
    expect(within(facts).getByText("Lando Norris wins the Hungarian Grand Prix")).toBeVisible();
    await userEvent.click(within(facts).getByRole("button", { name: "Team" }));
    expect(within(facts).queryByText("Lando Norris wins the Hungarian Grand Prix")).toBeNull();
  });

  it("shows both championships with links to the full standings", async () => {
    renderRoute("/");

    const drivers = await screen.findByRole("region", { name: "2025 drivers" });
    const teams = screen.getByRole("region", { name: "2025 constructors" });
    expect(within(drivers).getByRole("link", { name: /Full standings/ })).toHaveAttribute(
      "href",
      "/standings/2025",
    );
    expect(await within(teams).findByRole("link", { name: /McLaren/ })).toBeVisible();
  });

  it("lays the season out as a strip of rounds", async () => {
    renderRoute("/");

    const season = await screen.findByRole("region", { name: "Season 2025" });
    expect(await within(season).findAllByRole("listitem")).not.toHaveLength(0);
  });

  it("filters the facts by driver, team and race", async () => {
    renderRoute("/");

    const facts = await screen.findByRole("region", { name: "Last race in facts" });
    for (const name of ["Driver", "Race", "Team", "All"]) {
      await userEvent.click(within(facts).getByRole("button", { name }));
      expect(within(facts).getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
      expect(within(facts).getAllByRole("listitem").length).toBeGreaterThan(0);
    }
  });

  it("shows how each driver moved in the standings since the last round", async () => {
    renderRoute("/");

    const drivers = await screen.findByRole("region", { name: "2025 drivers" });
    expect(await within(drivers).findByRole("link", { name: /Norris/ })).toBeVisible();
    expect(within(drivers).getByRole("columnheader", { name: "Evo." })).toBeVisible();
  });

  it("falls back to the code when a driver photo fails to load", async () => {
    renderRoute("/");

    const podium = await screen.findByRole("list", { name: "Podium" });
    for (const img of podium.querySelectorAll("img")) img.dispatchEvent(new Event("error"));
    expect(await within(podium).findByText("NOR")).toBeInTheDocument();
  });

  it("leaves out the figures a race report does not have", async () => {
    server.use(
      http.get("*/api/v1/news/reports/:id", () =>
        HttpResponse.json({
          ...hungaryReport,
          pit_stops: null,
          biggest_gain: null,
          fastest_lap: null,
          winner_wins: null,
          winner_strategy: null,
          retirements: [],
          teams: [],
          neutralisations: null,
          story: null,
          championship: { ...hungaryReport.championship, leader_changed: true },
        }),
      ),
      http.get("*/api/v1/home", () => HttpResponse.json({ ...homeResponse, next_event: null })),
    );
    renderRoute("/");

    const facts = await screen.findByRole("region", { name: "Last race in facts" });
    expect(await within(facts).findByText(/takes the lead/)).toBeVisible();
    expect(screen.queryByRole("region", { name: "Biggest climber" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Fastest pit stop" })).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("says when nothing is loaded yet", async () => {
    server.use(
      http.get("*/api/v1/home", () =>
        HttpResponse.json({ ...homeResponse, last_race: null, next_event: null }),
      ),
    );
    renderRoute("/");

    expect(await screen.findByText("No race loaded yet")).toBeVisible();
  });
});

describe("Phone menu", () => {
  it("opens the sections and closes after choosing one", async () => {
    renderRoute("/");

    await userEvent.click(await screen.findByRole("button", { name: "Open the menu" }));
    const menu = screen.getAllByRole("navigation", { name: "Main" }).at(-1) ?? document.body;
    expect(menu).toHaveAttribute("id", "site-menu");
    await userEvent.click(within(menu).getByRole("link", { name: "Drivers" }));

    expect(await screen.findByRole("button", { name: "Open the menu" })).toBeVisible();
    expect(document.getElementById("site-menu")).toBeNull();
  });
});
