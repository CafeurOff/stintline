import { fireEvent, screen } from "@testing-library/react";

import { renderWithProviders } from "@/test/render";

import { Face } from "./Face";
import { Move } from "./Move";
import { RoundBars } from "./RoundBars";

describe("Move", () => {
  it("says how many places were gained or lost", () => {
    renderWithProviders(
      <>
        <Move value={2} />
        <Move value={-3} />
        <Move value={0} />
      </>,
    );

    expect(screen.getByText("places gained")).toBeInTheDocument();
    expect(screen.getByText("places lost")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeVisible();
  });
});

describe("Face", () => {
  it("falls back to the code when the photo fails", () => {
    const { container } = renderWithProviders(
      <Face url="https://example.test/x.webp" label="NOR" colour="F47600" className="size-8" />,
    );
    const img = container.querySelector("img");
    if (!img) throw new Error("no photo");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");

    fireEvent.error(img);

    expect(screen.getByText("NOR")).toBeInTheDocument();
  });

  it("fetches the main picture first and the others lazily", () => {
    const { container } = renderWithProviders(
      <>
        <Face url="https://example.test/a.webp" label="NOR" colour={null} className="" priority />
        <Face url="https://example.test/b.webp" label="PIA" colour={null} className="" />
      </>,
    );
    const [main, other] = container.querySelectorAll("img");

    expect(main).toHaveAttribute("loading", "eager");
    expect(main).toHaveAttribute("fetchpriority", "high");
    expect(other).toHaveAttribute("loading", "lazy");
  });
});

describe("RoundBars", () => {
  it("draws one bar per race with its kind", () => {
    const { container } = renderWithProviders(
      <RoundBars
        colour="#ff0000"
        bars={[
          { key: "1", kind: "hit", label: "Bahrain" },
          { key: "2", kind: "sprint", label: "China sprint" },
          { key: "3", kind: "miss", label: "China" },
          { key: "4", kind: "dnf", label: "Japan" },
          { key: "5", kind: "hit", value: 0.5, label: "Miami" },
        ]}
      />,
    );

    const bars = container.querySelectorAll("span[title]");
    expect(bars).toHaveLength(5);
    expect(bars[1]).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0)" });
    expect(bars[4]).toHaveStyle({ height: "50%" });
  });
});
