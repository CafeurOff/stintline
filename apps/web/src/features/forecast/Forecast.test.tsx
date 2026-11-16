import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("Weather forecasts", () => {
  it("lists the weather of each session on the Grand Prix page, with the credit", async () => {
    renderRoute("/events/14");

    const panel = await screen.findByRole("region", { name: "Weekend weather" });
    const table = within(panel).getByRole("table", { name: "Weekend weather" });
    const quali = within(table).getByRole("row", { name: /Qualifying/ });
    expect(within(quali).getByText("Rain")).toBeVisible();
    expect(within(quali).getByText("55 %")).toBeVisible();
    expect(within(quali).getByText("27–28 °C")).toBeVisible();
    expect(within(panel).getByRole("link", { name: "Open-Meteo" })).toHaveAttribute(
      "href",
      "https://open-meteo.com/",
    );
  });

  it("shows nothing when no forecast exists yet", async () => {
    server.use(http.get("*/api/v1/forecasts", () => HttpResponse.json([])));
    renderRoute("/events/14");

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Weekend weather" })).toBeNull();
  });

  it("puts the race forecast on the calendar card of a coming Grand Prix", async () => {
    renderRoute("/calendar/2025");

    const card = (await screen.findByRole("link", { name: "Hungarian Grand Prix" })).closest(
      "article",
    );
    if (!card) throw new Error("card not found");
    expect(await within(card).findByText("Clear")).toBeInTheDocument();
    expect(within(card).getByText("31°")).toBeVisible();
  });
});
