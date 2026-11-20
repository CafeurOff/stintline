import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { seasonsResponse, server, SESSION_ID } from "@/test/server";

describe("Calendar page", () => {
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
});
