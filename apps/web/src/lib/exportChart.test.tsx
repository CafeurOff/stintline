import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, renderHook } from "@testing-library/react";

import { ChartTools } from "@/components/charts/ChartTools";
import { useZoom } from "@/components/charts/zoom";
import { renderWithProviders } from "@/test/render";

import { fileSlug, standaloneSvg, toCsv } from "./exportChart";

describe("chart exports", () => {
  it("writes CSV that spreadsheets read, accents and commas included", () => {
    const csv = toCsv([
      ["Driver", "Time"],
      ["Pérez, Sergio", 81.2],
      ['Say "hi"', null],
    ]);

    expect(csv.startsWith("﻿Driver,Time\r\n")).toBe(true);
    expect(csv).toContain('"Pérez, Sergio",81.2\r\n');
    expect(csv).toContain('"Say ""hi""",\r\n');
  });

  it("names files after the chart", () => {
    expect(fileSlug("Rythme de course : Grand Prix du Brésil")).toBe(
      "rythme-de-course-grand-prix-du-bresil",
    );
    expect(fileSlug("???")).toBe("stintline-chart");
  });

  it("writes the theme colours into a copy of the chart", () => {
    document.documentElement.style.setProperty("--color-ink", "#123456");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "300");
    svg.setAttribute("height", "100");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "var(--color-ink)");
    line.setAttribute("style", "fill: var(--color-ink)");
    svg.append(line);

    const { markup, width, height } = standaloneSvg(svg);

    expect(markup).toContain('stroke="#123456"');
    expect(markup).toContain("fill: #123456");
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect([width, height]).toEqual([300, 116]);
    document.documentElement.style.removeProperty("--color-ink");
  });
});

describe("chart tools", () => {
  function Harness({ withCsv }: { withCsv: boolean }) {
    const zoom = useZoom({ x: [0, 1], y: [0, 1] }, "k");
    return (
      <div>
        <ChartTools zoom={zoom} csv={withCsv ? () => [["a"], [1]] : undefined} />
        <svg role="img">
          <title>Pace</title>
        </svg>
      </div>
    );
  }

  it("copies the link of the view and says so", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness withCsv={false} />);

    await user.click(screen.getByRole("button", { name: "Copy the link to this view" }));

    expect(await navigator.clipboard.readText()).toBe(window.location.href);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
    expect(screen.queryByRole("button", { name: /CSV/ })).not.toBeInTheDocument();
  });

  it("tells the reader to copy the address when the clipboard is refused", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness withCsv={false} />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: "Copy the link to this view" }));

    expect(screen.getByRole("status")).toHaveTextContent(/browser bar/);
  });

  it("offers the data as a CSV file named after the chart", async () => {
    const created = vi.fn(() => "blob:csv");
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    renderWithProviders(<Harness withCsv />);

    await userEvent.click(screen.getByRole("button", { name: "Download the data (CSV)" }));

    expect(created).toHaveBeenCalled();
    expect(clicks).toEqual(["pace.csv"]);
  });

  it("says so when the picture cannot be made", async () => {
    vi.stubGlobal(
      "Image",
      class {
        onerror: (() => void) | null = null;
        set src(_url: string) {
          setTimeout(() => this.onerror?.(), 0);
        }
      },
    );
    renderWithProviders(<Harness withCsv={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Save the chart as a picture" }));

    expect(await screen.findByText("The picture could not be made")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("keeps the zoom hook usable on its own", () => {
    const { result } = renderHook(() => useZoom({ x: [0, 10], y: [0, 1] }, "z"));
    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.zoomed).toBe(true);
  });
});
