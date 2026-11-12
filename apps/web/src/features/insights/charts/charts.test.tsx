import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/test/render";

import { GapStrip } from "./GapStrip";
import { LapScatter } from "./LapScatter";
import { LossBars } from "./LossBars";
import { PaceBoxes } from "./PaceBoxes";
import { RoundGapBars } from "./RoundGapBars";
import { SplitBar } from "./SplitBar";

const COLOURS = ["#ff8000", "#888888"] as const;
const fmt = (v: number) => v.toFixed(2);

describe("analysis charts", () => {
  it("splits a tally and shows both counts", () => {
    renderWithProviders(<SplitBar label="Race" counts={[3, 1]} colours={COLOURS} note="(dry)" />);

    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("(dry)")).toBeVisible();
  });

  it("draws an empty bar when nothing was decided", () => {
    const { container } = renderWithProviders(
      <SplitBar label="Pace" counts={[]} colours={COLOURS} />,
    );

    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(container.querySelectorAll("[aria-hidden] span")).toHaveLength(0);
  });

  it("puts gaps on a strip with a median and clamps the extremes", () => {
    const { container } = renderWithProviders(
      <GapStrip
        label="Quali gaps"
        dots={[
          { key: "1", value: -0.2, label: "Bahrain" },
          { key: "2", value: 3, label: "Monaco" },
        ]}
        colours={COLOURS}
        ends={["A faster", "B faster"]}
        median={0.1}
        format={fmt}
        limit={1}
      />,
    );

    expect(screen.getByRole("img", { name: "Quali gaps" })).toBeVisible();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(screen.getByText("Monaco: 3.00")).toBeInTheDocument();
  });

  it("draws a strip without a median", () => {
    const { container } = renderWithProviders(
      <GapStrip
        label="Gaps"
        dots={[]}
        colours={COLOURS}
        ends={["A", "B"]}
        median={null}
        format={fmt}
        limit={1}
      />,
    );

    expect(container.querySelectorAll("line")).toHaveLength(2);
  });

  it("draws one bar per round with data, up for the first driver", () => {
    const { container } = renderWithProviders(
      <RoundGapBars
        label="Pace gaps"
        rounds={[
          { key: "1", short: "1", label: "Bahrain", value: -0.3 },
          { key: "2", short: "2", label: "Jeddah", value: 0.2 },
          { key: "3", short: "3", label: "Miami", value: null },
        ]}
        colours={COLOURS}
        names={["NOR faster", "PIA faster"]}
        format={fmt}
      />,
    );

    const bars = container.querySelectorAll("rect");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("fill", COLOURS[0]);
    expect(bars[1]).toHaveAttribute("fill", COLOURS[1]);
  });

  it("draws pit loss bars with and without a spread, and shortens long names", () => {
    const { container } = renderWithProviders(
      <LossBars
        label="Pit loss"
        rows={[
          { key: "a", label: "A very long Grand Prix name indeed", value: 22, sigma: 1.5 },
          { key: "b", label: "Monaco", value: 20, sigma: null },
        ]}
        format={fmt}
        axisLabel="Seconds"
      />,
    );

    expect(screen.getByText("A very long Grand Pri…")).toBeInTheDocument();
    expect(container.querySelectorAll("g[stroke]")).toHaveLength(1);
  });

  it("draws boxes and only the outliers inside the axis", () => {
    const { container } = renderWithProviders(
      <PaceBoxes
        label="Boxes"
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
            outliers: [81.5, 79],
          },
        ]}
        format={fmt}
        axisLabel="Lap time"
      />,
    );

    expect(screen.getByText("NOR")).toBeInTheDocument();
    expect(container.querySelectorAll("circle").length).toBeLessThanOrEqual(2);
  });

  it("gives each driver its own marker shape", () => {
    const point = (lap: number) => ({ lap, value: 80 + lap / 10, compound: "SOFT", tip: "t" });
    const { container } = renderWithProviders(
      <LapScatter
        label="Laps"
        series={[
          { key: 1, label: "NOR", points: [point(2)] },
          { key: 2, label: "PIA", points: [point(3)] },
          { key: 3, label: "RUS", points: [point(4)] },
        ]}
        totalLaps={10}
        format={fmt}
        xLabel="Lap"
      />,
    );

    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
    expect(screen.getByText("RUS")).toBeVisible();
  });
});
