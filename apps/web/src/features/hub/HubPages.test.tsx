import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { driver } from "@/test/fixtures/hub";
import { session } from "@/test/fixtures/session";
import { problem, seasonsResponse, server, SESSION_ID } from "@/test/server";

describe("Hub pages", () => {
  it("lists a season's Grands Prix with winners and replay links", async () => {
    renderRoute("/calendar/2025");

    expect(await screen.findByRole("heading", { name: "2025 season" })).toBeVisible();
    expect(
      await screen.findByRole("link", { name: "Replay the Hungarian Grand Prix" }),
    ).toHaveAttribute("href", `/sessions/${SESSION_ID}`);
    expect(screen.getByRole("link", { name: "Hungarian Grand Prix" })).toHaveAttribute(
      "href",
      "/events/14",
    );
  });

  it("shows a Grand Prix's results and switches to qualifying", async () => {
    const { router } = renderRoute("/events/14");

    expect(await screen.findByRole("heading", { name: "Hungarian Grand Prix" })).toBeVisible();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Norris");
    expect(screen.getByRole("link", { name: "Replay on the circuit" })).toHaveAttribute(
      "href",
      `/sessions/${SESSION_ID}`,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Qualifying" }));

    expect(router.state.location.search).toBe("?session=Q");
  });

  it("shows a not-found page for an unknown Grand Prix", async () => {
    renderRoute("/events/999");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("shows drivers as a photo grid and searches across every season", async () => {
    let lastQuery = "";
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/api/v1/drivers?")) lastQuery = new URL(request.url).search;
    });
    renderRoute("/drivers");

    expect(await screen.findByRole("link", { name: /Hamilton/ })).toHaveAttribute(
      "href",
      "/drivers/hamilton",
    );
    await userEvent.type(screen.getByRole("searchbox", { name: "Search a driver" }), "senna");

    await vi.waitFor(() => {
      expect(lastQuery).toContain("search=senna");
    });
    expect(lastQuery).not.toContain("season=");
    server.events.removeAllListeners();
  });

  it("shows a driver's career, seasons and results", async () => {
    renderRoute("/drivers/norris");

    expect(await screen.findByRole("heading", { name: "Norris" })).toBeVisible();
    const career = screen.getByLabelText("Career in numbers");
    expect(career).toHaveTextContent("Wins11");
    expect(career).toHaveTextContent("Titles1");
    expect(screen.getByRole("heading", { name: "Season by season" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Results" })).toBeVisible();
  });

  it("credits the Wikipedia photo when there is no official portrait", async () => {
    server.use(
      http.get("*/api/v1/drivers/:ref", () => HttpResponse.json({ ...driver, media: null })),
    );
    renderRoute("/drivers/norris");

    const credit = await screen.findByRole("link", { name: /^Photo: / });
    expect(credit).toHaveAttribute("href", expect.stringContaining("commons.wikimedia.org"));
  });

  it("shows a not-found page for an unknown driver", async () => {
    renderRoute("/drivers/nobody");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("lists teams and shows a team's record", async () => {
    renderRoute("/teams");
    await userEvent.click(await screen.findByRole("link", { name: /McLaren/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "McLaren" })).toBeVisible();
    expect(screen.getByLabelText("Team in numbers")).toHaveTextContent("Constructors' titles");
  });

  it("shows the standings and switches to constructors", async () => {
    const { router } = renderRoute("/standings/2025");

    expect(await screen.findByRole("heading", { name: "2025 standings" })).toBeVisible();
    expect(
      await screen.findByRole("img", { name: /Championship points after each round/ }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Constructors" }));

    expect(router.state.location.search).toBe("?table=constructors");
    expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent("McLaren");
  });

  it("says when a season has no standings", async () => {
    server.use(
      http.get("*/api/v1/seasons/:year/standings", () => problem(404, "not_found", "Not found")),
      http.get("*/api/v1/seasons/:year/standings/progression", () =>
        HttpResponse.json({ season: 1950, rounds: [], drivers: [], constructors: [] }),
      ),
    );
    renderRoute("/standings/1950");

    expect(await screen.findByText("No standings stored for this season.")).toBeVisible();
  });

  it("speaks French on the hub pages", async () => {
    renderRoute("/drivers/norris", { locale: "fr" });

    expect(await screen.findByLabelText("Carrière en chiffres")).toHaveTextContent("Victoires");
    expect(screen.getByText("Royaume-Uni")).toBeVisible();
  });

  it("moves to another season from the calendar", async () => {
    server.use(
      http.get("*/api/v1/seasons", () =>
        HttpResponse.json({
          ...seasonsResponse,
          count: 2,
          results: [...seasonsResponse.results, { year: 2024, events_count: 24 }],
        }),
      ),
    );
    const { router } = renderRoute("/calendar/2025");

    const select = await screen.findByRole("combobox", { name: "Season" });
    await screen.findByRole("option", { name: "2024" });
    await userEvent.selectOptions(select, "2024");

    expect(router.state.location.pathname).toBe("/calendar/2024");
  });

  it("shows qualifying lap times", async () => {
    const qualifying = {
      ...session,
      id: 69,
      kind: "Q",
      entries: session.entries.map((entry, index) => ({
        ...entry,
        finish_position: index + 1,
        q1_s: 76 + index / 10,
        q2_s: index < 15 ? 75.5 + index / 10 : null,
        q3_s: index < 10 ? 75.2 + index / 10 : null,
      })),
    };
    server.use(http.get("*/api/v1/sessions/69", () => HttpResponse.json(qualifying)));
    renderRoute("/events/14?session=Q");

    const table = await screen.findByRole("table");
    expect(await within(table).findByText("1:15.200")).toBeVisible();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toContain("Q3");
  });

  it("shows a non-finish as its classification, not its order", async () => {
    renderRoute("/drivers/norris");

    const row = (await screen.findByRole("link", { name: "Las Vegas Grand Prix" })).closest("tr");

    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("DDisqualified");
    expect(row).not.toHaveTextContent("19");
  });

  it("sets the browser tab title to the driver's name", async () => {
    renderRoute("/drivers/norris");

    await screen.findByRole("heading", { name: "Norris" });

    expect(document.title).toBe("Lando Norris · StintLine");
  });

  it("switches season on a driver's results", async () => {
    const { router } = renderRoute("/drivers/norris");

    const select = await screen.findByRole("combobox", { name: "Season" });
    await userEvent.selectOptions(select, "2024");

    expect(router.state.location.search).toBe("?season=2024");
  });

  it("lists drivers of every season on request", async () => {
    const { router } = renderRoute("/drivers");

    const select = await screen.findByRole("combobox", { name: "Season" });
    await userEvent.selectOptions(select, "Every season");

    expect(router.state.location.search).toBe("?season=all");
  });

  it("searches teams by name", async () => {
    const { router } = renderRoute("/teams");

    await userEvent.type(await screen.findByRole("searchbox", { name: "Search a team" }), "ferr");

    expect(router.state.location.search).toBe("?q=ferr");
    expect(await screen.findByRole("link", { name: /Ferrari/ })).toBeVisible();
  });

  it("shows a not-found page for an unknown team", async () => {
    renderRoute("/teams/nobody");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("shows the standings after an earlier round", async () => {
    const { router } = renderRoute("/standings/2025");

    const select = await screen.findByRole("combobox", { name: "After" });
    await userEvent.selectOptions(select, "12");

    expect(router.state.location.search).toBe("?round=12");
  });

  it.each([
    ["/", "*/api/v1/home"],
    ["/calendar/2025", "*/api/v1/seasons/:year/events"],
    ["/events/14", "*/api/v1/events/:id"],
    ["/drivers", "*/api/v1/drivers"],
    ["/drivers/norris", "*/api/v1/drivers/:ref"],
    ["/teams", "*/api/v1/teams"],
    ["/teams/mclaren", "*/api/v1/teams/:ref"],
    ["/standings/2025", "*/api/v1/seasons/:year/standings"],
  ])("offers a retry when %s cannot load", async (path, endpoint) => {
    server.use(http.get(endpoint, () => problem(500, "server_error", "Server error")));
    renderRoute(path);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
  });
});
