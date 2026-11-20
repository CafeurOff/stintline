import { fireEvent, screen } from "@testing-library/react";
import type { Schema } from "@stintline/api-types";

import { SeasonBars } from "@/components/hub/SeasonBars";
import { LapChart } from "@/features/race-analysis/components/LapChart";
import { LapScatter } from "@/features/insights/charts/LapScatter";
import { PaceBoxes } from "@/features/insights/charts/PaceBoxes";
import { RoundGapBars } from "@/features/insights/charts/RoundGapBars";
import { ProgressionChart } from "@/features/standings/components/ProgressionChart";
import { DegradationChart } from "@/features/tyres/components/DegradationChart";
import { renderWithProviders } from "@/test/render";

/** The plot surface of the only chart on screen. */
function layer(): Element {
  return screen.getByTestId("zoom-layer");
}

function hover(at: { x: number; y: number }) {
  fireEvent.pointerMove(layer(), { clientX: at.x, clientY: at.y, pointerId: 1 });
}

function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(layer(), { clientX: from.x, clientY: from.y, pointerId: 1 });
  fireEvent.pointerMove(layer(), { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.pointerUp(layer(), { clientX: to.x, clientY: to.y, pointerId: 1 });
}

function click(at: { x: number; y: number }) {
  drag(at, { x: at.x + 2, y: at.y + 1 });
}

const reset = () => screen.getByRole("button", { name: "Show everything" });

/** Every chart zooms into a dragged box and comes back with a double-click. */
function expectZoomCycle(from = { x: 40, y: 40 }, to = { x: 300, y: 200 }) {
  expect(reset()).toBeDisabled();
  drag(from, to);
  expect(reset()).toBeEnabled();
  fireEvent.doubleClick(layer());
  expect(reset()).toBeDisabled();
}

beforeAll(() => {
  // jsdom has no pointer capture.
  Element.prototype.setPointerCapture = () => undefined;
});

describe("interactive charts", () => {
  it("progression: reads every line at a round, zooms on rounds and resets", () => {
    renderWithProviders(
      <ProgressionChart
        label="Title fight"
        rounds={[1, 2, 3, 4]}
        lines={[
          { key: "ver", label: "Verstappen", colour: "3671C6", points: [25, 43, 61, 86] },
          { key: "nor", label: "Norris", colour: "FF8000", points: [18, 43, null, 70] },
          { key: "pia", label: "Piastri", colour: "FF8000", points: [12, 20, 35, 50] },
        ]}
      />,
    );

    hover({ x: 600, y: 40 });
    expect(screen.getByText("After round 4")).toBeInTheDocument();
    expect(screen.getAllByText("86").length).toBeGreaterThan(0);

    fireEvent.pointerLeave(layer());
    expect(screen.queryByText("After round 4")).not.toBeInTheDocument();

    expectZoomCycle({ x: 10, y: 100 }, { x: 300, y: 102 });
    expectZoomCycle({ x: 100, y: 10 }, { x: 102, y: 250 });
  });

  it("lap chart: shows the cars at a lap, picks the nearest line and zooms", () => {
    const onPick = vi.fn();
    renderWithProviders(
      <LapChart
        label="Positions"
        totalLaps={5}
        invert
        yDomain={[1, 3]}
        xLabel="Lap"
        highlighted={new Set([4])}
        marks={[{ key: "m", car: 4, lap: 2, label: "5 s penalty" }]}
        onPick={onPick}
        series={[
          { key: 4, label: "NOR", colour: "FF8000", dashed: false, values: [1, 1, 2, 1, 1] },
          { key: 81, label: "PIA", colour: "FF8000", dashed: true, values: [2, 2, 1, 2, null] },
          { key: 1, label: "VER", colour: "3671C6", dashed: false, values: [3, 3, 3, 3, 2] },
        ]}
      />,
    );

    hover({ x: 300, y: 20 });
    expect(screen.getByText(/^Lap \d$/)).toBeInTheDocument();

    click({ x: 300, y: 20 });
    expect(onPick).toHaveBeenCalled();

    expectZoomCycle({ x: 20, y: 100 }, { x: 400, y: 102 });
    fireEvent.pointerLeave(layer());
  });

  it("degradation: shows the lap under the pointer and zooms", () => {
    const stint = (car: number, base: number): Schema<"StintFit"> => ({
      car_number: car,
      stint: 1,
      compound: "MEDIUM",
      model: "linear",
      coefficients: [base, 0.05],
      slope_s_per_lap: 0.05,
      slope_ci: [0.04, 0.06],
      r_squared: 0.8,
      rmse_s: 0.2,
      n_laps: 4,
      points: [1, 2, 3, 4].map((age) => ({ tyre_age: age, corrected_time_s: base + age * 0.05 })),
    });
    renderWithProviders(
      <DegradationChart
        label="Wear"
        stints={[stint(4, 80), stint(81, 80.6)]}
        styleFor={(car) => ({ colour: "#ff8000", dashed: car === 81, label: `Car ${String(car)}` })}
      />,
    );

    // Sweep the surface until the pointer lands near a lap.
    for (let px = 0; px < 700 && !screen.queryByText(/^Car /); px += 20) {
      for (let py = 0; py < 330 && !screen.queryByText(/^Car /); py += 20) hover({ x: px, y: py });
    }
    expect(screen.getByText(/^Car /)).toBeInTheDocument();

    expectZoomCycle();
  });

  it("pace boxes: names the driver under the pointer and zooms on times", () => {
    renderWithProviders(
      <PaceBoxes
        label="Pace"
        axisLabel="Lap time"
        format={(v) => v.toFixed(3)}
        boxes={[
          {
            key: 4,
            label: "NOR",
            colour: "FF8000",
            median: 80,
            q1: 79.8,
            q3: 80.3,
            low: 79.5,
            high: 80.8,
            outliers: [82],
          },
          {
            key: 1,
            label: "VER",
            colour: null,
            median: 80.4,
            q1: 80.1,
            q3: 80.6,
            low: 79.9,
            high: 81,
            outliers: [],
          },
        ]}
      />,
    );

    for (let py = 0; py < 200 && !screen.queryByText("80.000"); py += 4) hover({ x: 300, y: py });
    expect(screen.getAllByText(/80\.\d{3}/).length).toBeGreaterThan(0);
    fireEvent.pointerLeave(layer());

    expectZoomCycle({ x: 20, y: 10 }, { x: 400, y: 12 });
  });

  it("season bars: reads a season and zooms", () => {
    renderWithProviders(
      <SeasonBars
        label="Points"
        colour="FF8000"
        seasons={[2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => ({
          year,
          points: [49, 97, 160, 122, 205, 374, 423][i] ?? 0,
          position: i === 6 ? 1 : null,
        }))}
      />,
    );

    for (let px = 0; px < 700 && !screen.queryByText("374"); px += 10) hover({ x: px, y: 100 });
    expect(screen.getAllByText(/374/).length).toBeGreaterThan(0);
    fireEvent.pointerLeave(layer());

    expectZoomCycle();
  });

  it("round gaps: reads a round and zooms", () => {
    renderWithProviders(
      <RoundGapBars
        label="Gaps"
        colours={["#ff8000", "#888888"]}
        names={["NOR faster", "PIA faster"]}
        format={(v) => v.toFixed(3)}
        rounds={[
          { key: "1", short: "1", label: "Bahrain", value: -0.3 },
          { key: "2", short: "2", label: "Jeddah", value: 0.2 },
          { key: "3", short: "3", label: "Miami", value: null },
        ]}
      />,
    );

    for (let px = 0; px < 700 && !screen.queryByText("Bahrain"); px += 10) hover({ x: px, y: 60 });
    expect(screen.getByText("Bahrain")).toBeInTheDocument();
    fireEvent.pointerLeave(layer());

    expectZoomCycle({ x: 10, y: 20 }, { x: 400, y: 22 });
  });

  it("lap scatter: reads the lap under the pointer and zooms", () => {
    renderWithProviders(
      <LapScatter
        label="Every lap"
        totalLaps={4}
        xLabel="Lap"
        format={(v) => v.toFixed(3)}
        series={[
          {
            key: 4,
            label: "NOR",
            points: [1, 2, 3, 4].map((lap) => ({
              lap,
              value: 80 + lap / 10,
              compound: "SOFT",
              tip: `Lap ${String(lap)} tip`,
            })),
          },
        ]}
      />,
    );

    for (let px = 0; px < 700 && !screen.queryByText(/tip$/); px += 16) {
      for (let py = 0; py < 300 && !screen.queryByText(/tip$/); py += 16) hover({ x: px, y: py });
    }
    expect(screen.getAllByText(/tip$|NOR/).length).toBeGreaterThan(0);
    fireEvent.pointerLeave(layer());

    expectZoomCycle();
  });

  it("a cancelled drag zooms nothing", () => {
    renderWithProviders(
      <ProgressionChart
        label="Fight"
        rounds={[1, 2]}
        lines={[{ key: "a", label: "A", colour: null, points: [1, 2] }]}
      />,
    );

    fireEvent.pointerDown(layer(), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerCancel(layer());
    fireEvent.pointerUp(layer(), { clientX: 300, clientY: 200, pointerId: 1 });

    expect(reset()).toBeDisabled();
  });
});
