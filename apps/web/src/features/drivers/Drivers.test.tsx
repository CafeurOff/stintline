import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { driver, driverForm } from "@/test/fixtures/hub";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("Driver pages", () => {
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

  it("shows the last five Grands Prix with the pace gap to the teammate", async () => {
    renderRoute("/drivers/norris");

    const form = await screen.findByRole("region", { name: "Form" });
    const list = within(form).getByRole("list", { name: "Last Grands Prix" });
    const cells = within(list).getAllByRole("listitem");
    expect(cells).toHaveLength(5);
    expect(cells[0]).toHaveTextContent("R12");
    expect(cells[0]).toHaveTextContent("P1");
    expect(cells[0]).toHaveTextContent("from P3");
    expect(cells[0]).not.toHaveTextContent("vs ");
    expect(cells[2]).toHaveTextContent("vs Piastri+0.099 s");
    expect(cells[3]).toHaveTextContent("P18");
    expect(cells[3]).toHaveTextContent("Retired");
    expect(cells[4]).toHaveTextContent("vs Piastri−0.125 s");
    expect(form).toHaveTextContent("2 wins, 2 more podiums");
    expect(form).toHaveTextContent("Average start 2.2, average finish 4.8");
    expect(form).toHaveTextContent(
      "On average 0.013 s a lap quicker than Piastri, ahead in 1 of 2",
    );
  });

  it("writes a dash when a car has too few clean laps for a pace gap", async () => {
    const races = driverForm.races.map((r) => ({ ...r, pace_gap_s: null }));
    server.use(
      http.get("*/api/v1/drivers/:ref/form", () =>
        HttpResponse.json({ ...driverForm, races: races.slice(-1) }),
      ),
    );
    renderRoute("/drivers/norris");

    const form = await screen.findByRole("region", { name: "Form" });
    expect(within(form).getByText(/Fewer than 10 clean laps/)).toBeInTheDocument();
    expect(form).toHaveTextContent("1 podium");
    expect(form).not.toHaveTextContent("On average");
  });

  it("leaves the form out for a driver without a Grand Prix", async () => {
    server.use(
      http.get("*/api/v1/drivers/:ref/form", () => HttpResponse.json({ ...driverForm, races: [] })),
    );
    renderRoute("/drivers/norris");

    expect(await screen.findByRole("heading", { name: "Season by season" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Form" })).toBeNull();
  });

  it("offers a retry when the form does not load", async () => {
    server.use(
      http.get("*/api/v1/drivers/:ref/form", () =>
        HttpResponse.json({ title: "Oops", status: 500 }, { status: 500 }),
      ),
    );
    renderRoute("/drivers/norris");

    const form = await screen.findByRole("region", { name: "Form" });
    expect(await within(form).findByRole("button", { name: /retry/i })).toBeVisible();
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

  it("speaks French on the hub pages", async () => {
    renderRoute("/drivers/norris", { locale: "fr" });

    expect(await screen.findByLabelText("Carrière en chiffres")).toHaveTextContent("Victoires");
    expect(await screen.findByRole("region", { name: "Forme" })).toHaveTextContent(
      "face à Piastri",
    );
    expect(screen.getByText("Royaume-Uni")).toBeVisible();
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

  it("shows a non-finish as its classification, not its order", async () => {
    renderRoute("/drivers/norris");

    const row = (await screen.findByRole("link", { name: "Las Vegas Grand Prix" })).closest("tr");

    if (!row) throw new Error("no row for the Las Vegas Grand Prix");
    expect(within(row).getByTitle("Disqualified")).toHaveTextContent("DSQ");
    expect(row).not.toHaveTextContent("19");
  });
});
