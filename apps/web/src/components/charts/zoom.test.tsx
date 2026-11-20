import { act, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/render";

import { ChartTools } from "./ChartTools";
import { type Domain, isFull, scaleView, useZoom } from "./zoom";

const FULL: Domain = { x: [0, 100], y: [0, 10] };

describe("chart zoom", () => {
  it("scales a view around its centre and keeps it inside the full domain", () => {
    const view = scaleView({ x: [80, 100], y: [0, 10] }, FULL, 2);

    expect(view.x).toEqual([60, 100]);
    expect(view.y).toEqual([0, 10]);
  });

  it("knows when a view shows everything again", () => {
    expect(isFull({ x: [0, 100], y: [0, 10] }, FULL)).toBe(true);
    expect(isFull({ x: [10, 100], y: [0, 10] }, FULL)).toBe(false);
  });

  it("zooms in, out and back, and forgets the zoom when the data changes", () => {
    const { result, rerender } = renderHook(({ key }) => useZoom(FULL, key), {
      initialProps: { key: "a" },
    });

    act(() => {
      result.current.zoomTo({ x: [20, 40], y: [2, 4] });
    });
    expect(result.current.zoomed).toBe(true);
    expect(result.current.view.x).toEqual([20, 40]);

    rerender({ key: "b" });
    expect(result.current.zoomed).toBe(false);
    expect(result.current.view).toBe(FULL);
  });

  it("offers zoom buttons that keyboard users can reach", async () => {
    function Harness() {
      const zoom = useZoom(FULL, "k");
      return (
        <>
          <ChartTools zoom={zoom} />
          <p>{zoom.view.x.join("-")}</p>
        </>
      );
    }
    renderWithProviders(<Harness />);

    expect(screen.getByRole("button", { name: "Show everything" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Show everything" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Show everything" }));
    expect(screen.getByText("0-100")).toBeInTheDocument();
  });
});
