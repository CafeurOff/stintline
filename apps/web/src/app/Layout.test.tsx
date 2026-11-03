import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { seasonsResponse, server, SESSION_ID } from "@/test/server";

describe("Layout and navigation", () => {
  it("opens on the most recent race with data", async () => {
    const { router } = renderRoute("/");

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe("/sessions/80");
    });
  });

  it("explains how to load data when there is none", async () => {
    server.use(
      http.get("*/api/v1/seasons", () =>
        HttpResponse.json({ ...seasonsResponse, count: 0, results: [] }),
      ),
    );
    renderRoute("/");

    expect(await screen.findByText("No race loaded yet")).toBeVisible();
  });

  it("switches race from the header and keeps the view", async () => {
    const { router } = renderRoute(`/sessions/${SESSION_ID}/tyres`);

    const select = await screen.findByRole("combobox", { name: "Race" });
    await within(select).findByRole("option", { name: "Italian Grand Prix 2025" });
    await userEvent.selectOptions(select, "80");

    expect(router.state.location.pathname).toBe("/sessions/80/tyres");
  });

  it("links the race views and the explanation page", async () => {
    renderRoute(`/sessions/${SESSION_ID}`);
    await screen.findByRole("group", { name: /cars on track/ });

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Race" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Tyres" })).toHaveAttribute(
      "href",
      `/sessions/${SESSION_ID}/tyres`,
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
    expect(screen.getByRole("link", { name: "Course" })).toBeVisible();
  });

  it("shows a not-found page with a way back", async () => {
    renderRoute("/does-not-exist");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the races" })).toHaveAttribute("href", "/");
  });
});
