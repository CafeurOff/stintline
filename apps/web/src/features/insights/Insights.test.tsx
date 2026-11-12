import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server } from "@/test/server";

describe("Analysis pages", () => {
  it("shows every team's teammate duel with tiles and a link to compare", async () => {
    renderRoute("/analysis");

    expect(await screen.findByRole("heading", { name: "Head-to-head", level: 1 })).toBeVisible();
    expect(await screen.findByRole("region", { name: "McLaren" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Qualifying whitewash" })).toBeVisible();
    const mclaren = screen.getByRole("region", { name: "McLaren" });
    expect(within(mclaren).getByRole("link", { name: /Compare/ })).toHaveAttribute(
      "href",
      expect.stringContaining("mode=drivers") as string,
    );
    expect(screen.getByRole("table", { name: "Every duel" })).toBeVisible();
  });

  it("compares two drivers round by round", async () => {
    renderRoute("/analysis?mode=drivers&a=norris&b=piastri");

    expect(await screen.findByRole("heading", { name: "NOR vs PIA, 2025" })).toBeVisible();
    const rounds = screen.getByRole("table", { name: "Round by round" });
    expect(within(rounds).getAllByRole("row")).toHaveLength(7);
    expect(screen.getByRole("table", { name: "Season in figures" })).toHaveTextContent("Laps led");
  });

  it("asks for a second driver when only one is known", async () => {
    renderRoute("/analysis?mode=drivers&a=nobody");

    expect(await screen.findByText("Pick the second driver.")).toBeVisible();
  });

  it("shows an empty state for a season without results", async () => {
    server.use(
      http.get("*/api/v1/analysis/seasons/:year/teammates", () =>
        problem(404, "not_found", "No race results for this season."),
      ),
    );
    renderRoute("/analysis");

    expect(await screen.findByText("No race results for this season.")).toBeVisible();
  });

  it("ranks race pace and switches to raw lap times", async () => {
    const { router } = renderRoute("/analysis/pace?session=70");

    expect(
      await screen.findByRole("heading", { name: "Race pace: Hungarian Grand Prix" }),
    ).toBeVisible();
    const ranking = await screen.findByRole("table", { name: "Pace ranking" });
    expect(within(ranking).getAllByRole("row")).toHaveLength(5);
    expect(
      screen.getByRole("img", { name: "Lap time distribution of every driver" }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("radio", { name: "Raw" }));

    expect(router.state.location.search).toContain("fuel=raw");
  });

  it("ranks drivers by consistency with a map of every race", async () => {
    renderRoute("/analysis/consistency");

    const ranking = await screen.findByRole("table", { name: "Season ranking" });
    expect(within(ranking).getAllByRole("row")[1]).toHaveTextContent("Verstappen");
    expect(screen.getByRole("table", { name: "Consistency map" })).toBeVisible();
  });

  it("shows pit stops, team averages and pit loss per race", async () => {
    renderRoute("/analysis/pit-stops");

    expect(await screen.findByRole("region", { name: "Fastest pit stop" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Teams" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Race by race" })).toBeVisible();
  });

  it("lists circuits and opens one circuit's DNA", async () => {
    renderRoute("/circuits");

    await userEvent.click(await screen.findByRole("link", { name: "Suzuka Circuit" }));

    expect(await screen.findByRole("heading", { name: "Suzuka Circuit", level: 1 })).toBeVisible();
    expect(screen.getByRole("region", { name: "Winning strategies" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Race by race" })).toBeVisible();
  });

  it("says when a circuit has no timed race", async () => {
    renderRoute("/circuits/nowhere");

    expect(await screen.findByText("No timed race at this circuit.")).toBeVisible();
  });

  it("puts the analysis pages in the sidebar", async () => {
    renderRoute("/analysis/consistency");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Track DNA" })).toHaveAttribute(
      "href",
      "/circuits",
    );
  });
});
