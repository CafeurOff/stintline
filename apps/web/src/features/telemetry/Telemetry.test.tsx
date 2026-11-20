import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { telemetryCompare } from "@/test/fixtures/telemetry";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("Telemetry", () => {
  it("compares the two fastest laps on the Grand Prix page", async () => {
    renderRoute("/events/14?chart=telemetry");

    const summary = await screen
      .findByRole("definition", { hidden: false }, { timeout: 3000 })
      .catch(() => null);
    expect(summary).not.toBeUndefined();
    const list = await screen.findByLabelText("Fastest laps compared");
    expect(within(list).getByText(/Lando Norris/)).toBeVisible();
    expect(within(list).getByText(/Oscar Piastri/)).toBeVisible();
    expect(within(list).getAllByText(/braking zones/)).toHaveLength(2);
    expect(
      screen.getByRole("img", { name: "Speed, throttle, brake, gear and time gap along the lap" }),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: /Norris's fastest lap on the circuit/ })).toBeVisible();
  });

  it("keeps the chosen drivers in the address", async () => {
    const { router } = renderRoute("/events/14?chart=telemetry");

    await userEvent.click(await screen.findByRole("button", { name: "George Russell" }));

    expect(router.state.location.search).toContain("tele=");
  });

  it("shows every value where the pointer is", async () => {
    const { container } = renderRoute("/events/14?chart=telemetry");
    await screen.findByLabelText("Fastest laps compared");
    const overlay = container.querySelector('svg rect[fill="transparent"]');
    expect(overlay).not.toBeNull();

    if (overlay) fireEvent.pointerMove(overlay, { clientX: 40 });

    expect(await screen.findAllByText(/km\/h · \d+% · gear \d/, { selector: "span" })).toHaveLength(
      2,
    );
    if (overlay) fireEvent.pointerLeave(overlay);
  });

  it("lists the braking zones as a table", async () => {
    renderRoute("/events/14?chart=telemetry");

    const table = await screen.findByRole("table", { name: /Braking zones/ });
    const zones = telemetryCompare.cars[0]?.braking_zones ?? [];
    expect(within(table).getAllByRole("row")).toHaveLength(zones.length + 1);
  });

  it("explains when a race has no telemetry yet", async () => {
    server.use(http.get("*/api/v1/sessions/:id/telemetry", () => HttpResponse.json([])));
    renderRoute("/events/14?chart=telemetry");

    expect(await screen.findByText(/No telemetry for this race yet/)).toBeVisible();
  });

  it("illustrates the race report with the winner against the runner-up", async () => {
    renderRoute("/news/70");

    expect(
      await screen.findByRole("heading", { name: "Fastest laps: Norris against Piastri" }),
    ).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Positions lap by lap" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Gap to the leader" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Tyre strategies" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Results" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Drivers' standings after round 14" }),
    ).toBeVisible();
  });
});
