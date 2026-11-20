import { screen } from "@testing-library/react";
import { http } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server } from "@/test/server";

describe("Hub pages", () => {
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
