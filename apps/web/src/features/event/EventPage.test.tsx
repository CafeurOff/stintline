import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { session } from "@/test/fixtures/session";
import { renderRoute } from "@/test/render";
import { server, SESSION_ID } from "@/test/server";

describe("Grand Prix page", () => {
  it("shows a Grand Prix's results and switches to qualifying", async () => {
    const { router } = renderRoute("/events/14");

    expect(await screen.findByRole("heading", { name: "Hungarian Grand Prix" })).toBeVisible();
    const results = await screen.findByRole("region", { name: "Results" });
    const table = within(results).getByRole("table");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Norris");
    expect(screen.getByRole("link", { name: "Replay on the circuit" })).toHaveAttribute(
      "href",
      `/sessions/${SESSION_ID}`,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Qualifying" }));

    expect(router.state.location.search).toBe("?session=Q");
  });

  it("lists every session of the weekend, linking only the replays that are ready", async () => {
    renderRoute("/events/14");

    const weekend = await screen.findByRole("region", { name: "Weekend sessions" });
    const links = within(weekend).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([`/sessions/${SESSION_ID}`]);
    expect(within(weekend).getByText("Practice 1")).toBeVisible();
    expect(within(weekend).getAllByText("Being imported")).toHaveLength(4);
  });

  it("shows a not-found page for an unknown Grand Prix", async () => {
    renderRoute("/events/999");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
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
});
