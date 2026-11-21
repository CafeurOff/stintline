import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";

import { renderRoute } from "@/test/render";
import { circuitUndercuts } from "@/test/fixtures/undercuts";
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

    expect(await screen.findByRole("heading", { name: "Race pace" })).toBeVisible();
    expect(await screen.findByText("Hungarian Grand Prix")).toBeVisible();
    await waitFor(() => {
      expect(document.title).toContain("Race pace: Hungarian Grand Prix");
    });
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

  it("lists every undercut tried at a circuit with what it gained", async () => {
    renderRoute("/circuits/bahrain");

    const panel = await screen.findByRole("region", { name: "Every undercut here" });
    expect(
      await within(panel).findByText("8 green-flag attempts since 2023, 6 gained the place"),
    ).toBeVisible();
    expect(
      within(panel).getByText("+3.0 s median gain on the car ahead (dry races)"),
    ).toBeVisible();
    const attempts = within(panel).getAllByRole("listitem");
    expect(attempts).toHaveLength(8);
    const bearman = attempts.find((li) => li.textContent.includes("Bearman"));
    expect(bearman).toHaveTextContent("1.6 s behind → 5.8 s ahead");
    expect(bearman).toHaveTextContent("+7.3 s");
    expect(bearman).toHaveTextContent("Came out ahead");
    const norris = attempts.find((li) => li.textContent.includes("Norris"));
    expect(norris).toHaveTextContent("−2.1 s");
    expect(norris).toHaveTextContent("Stayed behind");
    expect(
      within(panel).getByRole("link", {
        name: "Open the undercut simulator: BEA on ALB, 2025",
      }),
    ).toHaveAttribute("href", "/sessions/20?mode=undercut&car=87&lap=13");
  });

  it("says when a circuit has too few dry undercuts for a median", async () => {
    const [first] = circuitUndercuts.attempts;
    server.use(
      http.get("*/api/v1/analysis/circuits/:ref/undercuts", () =>
        HttpResponse.json({ ...circuitUndercuts, attempts: [first], median_gain_s: null }),
      ),
    );
    renderRoute("/circuits/bahrain", { locale: "fr" });

    const panel = await screen.findByRole("region", { name: "Tous les undercuts ici" });
    expect(
      await within(panel).findByText(
        "Trop peu de tentatives sur le sec pour une médiane (au moins 3)",
      ),
    ).toBeVisible();
  });

  it("says when no undercut was tried at a circuit", async () => {
    server.use(
      http.get("*/api/v1/analysis/circuits/:ref/undercuts", () =>
        HttpResponse.json({ ...circuitUndercuts, attempts: [], successes: 0, median_gain_s: null }),
      ),
    );
    renderRoute("/circuits/bahrain");

    expect(await screen.findByText("No green-flag undercut tried here yet.")).toBeVisible();
  });

  it("offers a retry when the undercuts cannot be loaded", async () => {
    server.use(
      http.get("*/api/v1/analysis/circuits/:ref/undercuts", () =>
        problem(503, "upstream_unavailable", "Upstream unavailable"),
      ),
    );
    renderRoute("/circuits/bahrain");

    const panel = await screen.findByRole("region", { name: "Every undercut here" });
    expect(await within(panel).findByRole("button", { name: /retry/i })).toBeVisible();
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
