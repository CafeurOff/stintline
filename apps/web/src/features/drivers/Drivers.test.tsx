import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { driver } from "@/test/fixtures/hub";
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
});
