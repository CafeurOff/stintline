import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute, renderWithProviders } from "@/test/render";
import { powerUnits, upgrades } from "@/test/fixtures/technical";
import { problem, server } from "@/test/server";

import { CarDiagram } from "./components/CarDiagram";

describe("Technical page", () => {
  it("shows the upgrades by team and round and the parts on the car", async () => {
    const { router } = renderRoute("/technical?season=2025");

    expect(await screen.findByRole("heading", { name: "Technical", level: 1 })).toBeVisible();
    expect(await screen.findByRole("region", { name: "Parts declared" })).toHaveTextContent("5");
    const heatmap = screen.getByRole("table", { name: "Upgrades by team and round" });
    const cell = within(heatmap).getByRole("button", { name: /Racing Bulls|RB/ });
    await userEvent.click(cell);

    expect(router.state.location.search).toContain("round=14");
    expect(await screen.findByText("Cooling Louvres")).toBeVisible();
    expect(screen.getByRole("img", { name: /updated areas: .*Engine cover/ })).toBeVisible();
  });

  it("lists power-unit elements against the allowance", async () => {
    renderRoute("/technical?season=2025&tab=power-units");

    const matrix = await screen.findByRole("table", { name: "Elements used per driver" });
    expect(within(matrix).getAllByRole("row")).toHaveLength(21);
    expect(within(matrix).getByRole("columnheader", { name: /EX\s*max 8/ })).toBeVisible();
    expect(screen.getByRole("region", { name: "New elements this season" })).toHaveTextContent(
      "EX 5/8",
    );
  });

  it("groups incidents by kind and counts licence points", async () => {
    renderRoute("/technical?season=2025&tab=incidents");

    expect(await screen.findByRole("region", { name: "Incidents by kind" })).toHaveTextContent(
      "Collision",
    );
    expect(screen.getByRole("region", { name: "Decisions by session" })).toHaveTextContent("Race");
    const licence = screen.getByRole("table", { name: "Penalty points on the licence" });
    expect(within(licence).getAllByRole("row").length).toBeGreaterThan(2);
    expect(screen.getByRole("table", { name: "Every decision" })).toBeVisible();
  });

  it("switches tabs through the URL", async () => {
    const { router } = renderRoute("/technical?season=2025");

    await userEvent.click(await screen.findByRole("radio", { name: "Incidents" }));
    expect(router.state.location.search).toContain("tab=incidents");
    await userEvent.click(screen.getByRole("radio", { name: "Upgrades" }));
    expect(router.state.location.search).not.toContain("tab=");
  });

  it("explains a season without technical reports", async () => {
    server.use(
      http.get("*/api/v1/technical/power-units", () =>
        problem(404, "not_found", "No power-unit report read."),
      ),
    );
    renderRoute("/technical?season=2025&tab=power-units");

    expect(await screen.findByText("No power-unit report read for this season yet.")).toBeVisible();
  });

  it("offers a retry when the upgrades fail", async () => {
    server.use(
      http.get("*/api/v1/technical/upgrades", () => problem(500, "error", "Server error")),
    );
    renderRoute("/technical?season=2025");

    expect(await screen.findByRole("button", { name: /retry/i })).toBeVisible();
  });
});

describe("Technical page with pace and limits", () => {
  it("shows the pace before and after an upgrade and the biggest shift", async () => {
    server.use(
      http.get("*/api/v1/technical/upgrades", () =>
        HttpResponse.json({
          ...upgrades,
          teams: upgrades.teams.map((team) => ({
            ...team,
            cells: team.cells.map((cell) => ({
              ...cell,
              pace_before_pct: 1.2,
              pace_after_pct: 0.7,
              races_before: 3,
              races_after: 3,
            })),
          })),
        }),
      ),
    );
    renderRoute("/technical?season=2025");

    expect(
      await screen.findByRole("region", { name: "Race pace against the field" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Biggest pace shift after an upgrade" }),
    ).toHaveTextContent("-0.50");
  });

  it("marks elements at and beyond the allowance", async () => {
    const [first, second, ...rest] = powerUnits.cars;
    if (!first || !second) throw new Error("fixture has cars");
    server.use(
      http.get("*/api/v1/technical/power-units", () =>
        HttpResponse.json({
          ...powerUnits,
          allowed: { ...powerUnits.allowed, ICE: 4 },
          cars: [
            {
              ...first,
              used: { ...first.used, ICE: 6 },
              over: ["ICE"],
              beyond: 1,
              changes: [
                {
                  ...first.changes[0],
                  event_id: 14,
                  round: 14,
                  name: "Hungarian Grand Prix",
                  country: "Hungary",
                  element: "ICE",
                  number: 6,
                  allowed: 4,
                  compliant: false,
                },
              ],
            },
            { ...second, used: { ...second.used, ICE: 4 } },
            ...rest,
          ],
        }),
      ),
    );
    renderRoute("/technical?season=2025&tab=power-units");

    expect((await screen.findAllByText("beyond the allowance")).length).toBeGreaterThan(0);
    expect(screen.getByText("Over limit")).toBeVisible();
  });
});

describe("CarDiagram", () => {
  it("names the areas an upgrade touches", () => {
    renderWithProviders(<CarDiagram zones={new Set(["floor", "rear_wing"])} colour="FF8000" />);

    expect(screen.getByRole("img", { name: /Floor, Rear wing/ })).toBeVisible();
  });

  it("says when no area is touched", () => {
    renderWithProviders(<CarDiagram zones={new Set()} colour={null} />);

    expect(screen.getByRole("img", { name: /no area updated/ })).toBeVisible();
  });
});
