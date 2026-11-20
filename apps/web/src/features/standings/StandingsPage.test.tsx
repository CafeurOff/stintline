import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server } from "@/test/server";

describe("Standings page", () => {
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

  it("shows the standings after an earlier round", async () => {
    const { router } = renderRoute("/standings/2025");

    // Disabled while the standings load (it holds the header's height).
    const select = await screen.findByRole("combobox", { name: "After" });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    await userEvent.selectOptions(select, "12");

    expect(router.state.location.search).toBe("?round=12");
  });
});
