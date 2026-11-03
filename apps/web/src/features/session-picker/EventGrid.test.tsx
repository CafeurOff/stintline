import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { problem, seasonsResponse, server } from "@/test/server";

describe("EventGrid", () => {
  it("lists only rounds with timing data, linking to their race", async () => {
    renderRoute("/");

    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByRole("link", { name: "Hungarian Grand Prix: Race strategy" }),
    ).toHaveAttribute("href", "/sessions/70");
    expect(screen.getByText("3 of 4 rounds have timing data")).toBeInTheDocument();
  });

  it("shows the full calendar on demand", async () => {
    renderRoute("/");
    await screen.findByText("Hungarian Grand Prix");

    await userEvent.click(screen.getByRole("button", { name: "Show full calendar" }));

    expect(screen.getByText("Australian Grand Prix")).toBeInTheDocument();
    expect(screen.getByText("No timing data loaded")).toBeInTheDocument();
  });

  it("explains how to load data when no season exists", async () => {
    server.use(
      http.get("*/api/v1/seasons", () =>
        HttpResponse.json({ ...seasonsResponse, count: 0, results: [] }),
      ),
    );
    renderRoute("/");

    expect(await screen.findByText("No season loaded yet")).toBeInTheDocument();
  });

  it("offers a retry when seasons fail to load", async () => {
    server.use(
      http.get("*/api/v1/seasons", () => problem(503, "unavailable", "Service unavailable")),
    );
    renderRoute("/");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service unavailable");
    server.resetHandlers();
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Hungarian Grand Prix")).toBeInTheDocument();
  });
});
