import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { degradation } from "@/test/fixtures/degradation";
import { renderRoute } from "@/test/render";
import { server, SESSION_ID } from "@/test/server";

const path = `/sessions/${SESSION_ID}/degradation`;

describe("DegradationPage", () => {
  it("summarises each compound with its slope and interval", async () => {
    renderRoute(path);

    const soft = (await screen.findByText("Soft compound summary")).closest("li");
    expect(soft).toHaveTextContent("101 ms/lap");
    expect(soft).toHaveTextContent("95% CI 57–145");
  });

  it("selects the first finishers with fits by default", async () => {
    renderRoute(path);

    expect(await screen.findByRole("checkbox", { name: /NOR/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /PIA/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /LEC/ })).toBeChecked();
  });

  it("toggles drivers and lists their fits in the table", async () => {
    renderRoute(`${path}?cars=4`);

    await userEvent.click(await screen.findByRole("checkbox", { name: /LEC/ }));
    await userEvent.click(screen.getByText("Show fits as a table"));

    const table = screen.getByRole("table", { name: "Degradation fit per stint" });
    expect(within(table).getAllByRole("row", { name: /^NOR/ })).toHaveLength(2);
    expect(within(table).getAllByRole("row", { name: /^LEC/ }).length).toBeGreaterThan(0);
  });

  it("keeps at least one driver selected", async () => {
    renderRoute(`${path}?cars=4`);

    const only = await screen.findByRole("checkbox", { name: /NOR/ });

    expect(only).toBeChecked();
    expect(only).toBeDisabled();
  });

  it("explains when no stint could be fitted", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/degradation", () =>
        HttpResponse.json({ ...degradation, stints: [] }),
      ),
    );
    renderRoute(path);

    expect(await screen.findByText("Not enough clean laps to fit degradation")).toBeVisible();
  });
});
