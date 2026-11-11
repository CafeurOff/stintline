import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
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

  it("counts down to the next Grand Prix and lists its weekend", async () => {
    renderRoute("/");

    const next = await screen.findByRole("region", { name: "Italian Grand Prix" });
    expect(within(next).getByRole("timer")).toBeVisible();
    expect(within(next).getByRole("list", { name: "Weekend schedule" })).toBeVisible();
  });

  it("shows both championships with links to the full standings", async () => {
    renderRoute("/");

    const drivers = await screen.findByRole("region", { name: "2025 drivers" });
    const teams = screen.getByRole("region", { name: "2025 constructors" });
    expect(within(drivers).getByRole("link", { name: /Full standings/ })).toHaveAttribute(
      "href",
      "/standings/2025",
    );
    expect(within(teams).getByRole("link", { name: /McLaren/ })).toBeVisible();
  });

  it("lays the season out as a strip of rounds", async () => {
    renderRoute("/");

    const season = await screen.findByRole("region", { name: "Season 2025" });
    expect(await within(season).findAllByRole("listitem")).not.toHaveLength(0);
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
