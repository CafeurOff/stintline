import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

describe("Telemetry zoom, relief and 3D", () => {
  it("zooms on a corner, compares the drivers there and goes back to the whole lap", async () => {
    const { router } = renderRoute("/events/14?chart=telemetry");

    const corners = await screen.findByRole("group", { name: "Corners of the first driver's lap" });
    await userEvent.click(within(corners).getByRole("button", { name: "T1" }));

    expect(router.state.location.search).toMatch(/zoom=\d+-\d+/);
    const table = screen.getByRole("table", { name: "On this part of the lap" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Whole lap" }));
    expect(router.state.location.search).not.toContain("zoom=");
    expect(screen.queryByRole("table", { name: "On this part of the lap" })).toBeNull();
  });

  it("draws the relief under the charts and the gap in metres where the pointer is", async () => {
    const { container } = renderRoute("/events/14?chart=telemetry");
    await screen.findByLabelText("Fastest laps compared");
    const overlay = container.querySelector('svg rect[fill="transparent"]');

    if (overlay) fireEvent.pointerMove(overlay, { clientX: 120 });

    expect(screen.getByText("Relief (m)")).toBeInTheDocument();
    expect(await screen.findByText(/m up/)).toBeInTheDocument();
    const readout = (await screen.findByText(/m up/)).closest("[aria-live]");
    expect(readout?.textContent).toMatch(/s · [−-]?\d+ m/);
  });

  it("falls back to the map when the browser cannot draw 3D", async () => {
    const { router } = renderRoute("/events/14?chart=telemetry");

    await userEvent.click(await screen.findByRole("radio", { name: "3D lap" }));

    expect(router.state.location.search).toContain("lap=3d");
    expect(await screen.findByText(/cannot draw 3D/)).toBeVisible();
    expect(screen.getByRole("img", { name: /Norris's fastest lap on the circuit/ })).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Map" }));
    expect(router.state.location.search).not.toContain("lap=");
  });
});
