import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

describe("StrategyPage", () => {
  it("shows the session header and the views as tabs", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    expect(await screen.findByRole("heading", { name: "Hungarian Grand Prix" })).toBeVisible();
    const tabs = screen.getByRole("navigation", { name: "Session views" });
    expect(within(tabs).getByRole("link", { name: "Strategy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("puts the winner first on the podium", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    const podium = await screen.findByRole("region", { name: "Podium" });
    expect(within(podium).getAllByRole("listitem")[0]).toHaveTextContent("Lando Norris");
  });

  it("summarises the strategies and describes the timeline", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    expect(await screen.findByText(/Most used:/)).toHaveTextContent("M-H (9 drivers)");
    expect(
      screen.getByRole("img", { name: /Stint timeline: 20 drivers over 70 laps/ }),
    ).toBeVisible();
  });

  it("offers the stints as a table", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    await userEvent.click(await screen.findByText("Show stints as a table"));

    const table = screen.getByRole("table", { name: "Stints by driver" });
    expect(within(table).getAllByRole("row", { name: /Lando Norris/ })).toHaveLength(2);
  });

  it("shows the classification with positions gained", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    const table = await screen.findByRole("table", { name: "Classification" });
    const winner = within(table).getByRole("row", { name: /Lando Norris/ });
    expect(winner).toHaveTextContent("P3▲2");
  });

  it("shows the green-flag pit loss", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);

    const card = await screen.findByRole("region", { name: "Pit loss" });
    expect(await within(card).findByText("21.3 s")).toBeVisible();
    expect(within(card).getByText("± 2.1 s · 27 stops")).toBeVisible();
  });

  it("renders the not-found page for an unknown session", async () => {
    renderRoute("/sessions/999");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("renders the not-found page for a malformed id", async () => {
    renderRoute("/sessions/abc");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("reports a stint loading failure inside its card", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/stints", () => problem(500, "error", "Server error")),
    );
    renderRoute(`/sessions/${SESSION_ID}`);

    const card = await screen.findByRole("region", { name: "Tyre strategy" });
    expect(await within(card).findByRole("alert")).toHaveTextContent("Server error");
  });
});
