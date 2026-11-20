import type { Schema } from "@stintline/api-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { telemetryCompare } from "@/test/fixtures/telemetry";

import { carStyles } from "./colours";
import { Lap3DPanel } from "./Lap3DPanel";

// The WebGL scene cannot run in jsdom: a stand-in shows which camera and car it was given.
vi.mock("./Lap3DScene", () => ({
  default: ({ camera, follow, label }: { camera: string; follow: number; label: string }) => (
    <div role="img" aria-label={label}>
      {camera} {follow}
    </div>
  ),
}));

function Harness({ data = telemetryCompare }: { data?: Schema<"TelemetryCompare"> }) {
  const [cursor, setCursor] = useState<number | null>(null);
  return (
    <>
      <Lap3DPanel
        data={data}
        styles={carStyles(data.cars)}
        cursor={cursor}
        onCursor={setCursor}
        visible={[0, data.points - 1]}
      />
      <output aria-label="pointer">{cursor ?? "none"}</output>
      <button
        type="button"
        onClick={() => {
          setCursor(200);
        }}
      >
        point the charts
      </button>
    </>
  );
}

function renderPanel(data?: Schema<"TelemetryCompare">) {
  return render(
    <I18nProvider>
      <Harness {...(data ? { data } : {})} />
    </I18nProvider>,
  );
}

describe("Lap3DPanel", () => {
  it("replays the lap and moves the charts' pointer with it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel();
    expect(
      await screen.findByRole("img", { name: /Norris's fastest lap replayed in 3D/ }),
    ).toHaveTextContent("chase 0");

    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(screen.getByLabelText("pointer")).toHaveTextContent("0");
    vi.useRealTimers();
  });

  it("switches camera, followed car and speed", async () => {
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Trackside" }));
    const follow = screen.getByRole("group", { name: "Car followed" });
    await userEvent.click(within(follow).getByRole("button", { name: /PIA/ }));
    await userEvent.click(screen.getByRole("button", { name: "×4" }));

    expect(await screen.findByRole("img", { name: /3D/ })).toHaveTextContent("trackside 1");
    expect(screen.getByRole("button", { name: "×4" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Above" }));
    expect(screen.queryByRole("group", { name: "Car followed" })).toBeNull();
  });

  it("puts the cars where the charts point, with speeds and gaps", async () => {
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "point the charts" }));

    const slider = screen.getByRole("slider", { name: /Lap time/ });
    expect(Number((slider as HTMLInputElement).value)).toBeCloseTo(
      telemetryCompare.cars[0]?.t_s[200] ?? 0,
    );
    const hud = screen.getByRole("list", { name: "Each driver at this moment" });
    expect(within(hud).getAllByRole("listitem")).toHaveLength(2);
    expect(within(hud).getByText("reference")).toBeVisible();
    expect(within(hud).getByText(/ m · /)).toBeVisible();
    expect(screen.getByText("Relief drawn ×2")).toBeInTheDocument();
  });

  it("scrubs the lap, then pauses where the replay is", async () => {
    renderPanel();
    const slider = screen.getByRole("slider", { name: /Lap time/ });

    fireEvent.change(slider, { target: { value: "30" } });
    expect(screen.getByLabelText("pointer")).not.toHaveTextContent("none");
    expect(Number((slider as HTMLInputElement).value)).toBeCloseTo(30);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(Number((slider as HTMLInputElement).value)).toBeGreaterThanOrEqual(30);
  });

  it("says when a lap has no altitude and hides the car choice for one driver", () => {
    const [first] = telemetryCompare.cars;
    if (!first) throw new Error("fixture has cars");
    renderPanel({ ...telemetryCompare, cars: [{ ...first, elevation_m: null }] });

    expect(screen.getByText(/No altitude stored for this lap yet/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Car followed" })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("draws nothing without a car", () => {
    const { container } = renderPanel({ ...telemetryCompare, cars: [] });

    expect(container.querySelector("section")).toBeNull();
  });
});
