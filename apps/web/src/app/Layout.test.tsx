import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

describe("Layout and navigation", () => {
  it("opens on a home page with the last race and a way to replay it", async () => {
    renderRoute("/");

    const podium = await screen.findByRole("list", { name: "Podium" });
    expect(within(podium).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Replay it on the circuit" })).toHaveAttribute(
      "href",
      `/sessions/${SESSION_ID}`,
    );
    expect(screen.getByRole("heading", { name: "Italian Grand Prix" })).toBeVisible();
  });

  it("explains how to load data when there is none", async () => {
    server.use(
      http.get("*/api/v1/home", () =>
        HttpResponse.json({
          season: null,
          next_event: null,
          last_race: null,
          drivers: [],
          constructors: [],
        }),
      ),
    );
    renderRoute("/");

    expect(await screen.findByText("No race loaded yet")).toBeVisible();
  });

  it("picks another race in the race dialog and keeps the view", async () => {
    const { router } = renderRoute(`/sessions/${SESSION_ID}/tyres`);

    await userEvent.click(await screen.findByRole("button", { name: /Hungarian Grand Prix 2025/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose a race" });
    await userEvent.click(within(dialog).getByRole("link", { name: /Italian Grand Prix/ }));

    expect(router.state.location.pathname).toBe("/sessions/80/tyres");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters the race dialog by country", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    await userEvent.click(await screen.findByRole("button", { name: /Hungarian Grand Prix 2025/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose a race" });
    await userEvent.type(within(dialog).getByRole("searchbox"), "italy");

    const cards = within(dialog).getAllByRole("listitem");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Italian Grand Prix 2025");
  });

  it("links the hub pages and the race views", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);
    await screen.findByRole("group", { name: /cars on track/ });

    const main = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Grands Prix", "Drivers", "Teams", "Standings", "How it works"]) {
      expect(within(main).getByRole("link", { name })).toBeVisible();
    }
    const race = screen.getByRole("navigation", { name: "Race" });
    expect(within(race).getByRole("link", { name: "Circuit" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(race).getByRole("link", { name: "Tyres" })).toHaveAttribute(
      "href",
      `/sessions/${SESSION_ID}/tyres`,
    );
    expect(await within(race).findByRole("link", { name: "Results" })).toHaveAttribute(
      "href",
      "/events/14",
    );
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByText(/not associated with Formula 1/)).toBeVisible();
  });

  it("switches the interface to French", async () => {
    renderRoute("/model");

    await userEvent.click(screen.getByRole("button", { name: "fr" }));

    expect(
      await screen.findByRole("heading", { name: "Comment fonctionne StintLine" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Pilotes" })).toBeVisible();
  });

  it("shows a not-found page with a way back", async () => {
    renderRoute("/does-not-exist");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the home page" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("marks races without lap timing in the race dialog", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    await userEvent.click(await screen.findByRole("button", { name: /Hungarian Grand Prix 2025/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose a race" });
    const australia = within(dialog).getByText("Australian Grand Prix").closest("li");
    if (!australia) throw new Error("no card for Australia");

    expect(australia).toHaveTextContent("No lap timing for this race");
    expect(within(australia).queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains that a session without lap timing has no replay", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/replay", () =>
        problem(400, "invalid", "Invalid request", "Request validation failed."),
      ),
    );
    renderRoute(`/sessions/${SESSION_ID}`);

    expect(await screen.findByText(/no lap timing for this session/)).toBeVisible();
    expect(screen.getByRole("link", { name: "See the results" })).toHaveAttribute(
      "href",
      "/events/14",
    );
  });
});
