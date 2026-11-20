import { act, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { SectionTitle } from "@/components/hub/SectionTitle";
import { categoryKey } from "@/features/paddock/categories";

import { circuitAccent } from "./accent";
import { useElementWidth } from "./useElementWidth";

describe("small helpers", () => {
  it("gives a circuit the same accent every time", () => {
    expect(circuitAccent("monza")).toBe(circuitAccent("monza"));
    expect(circuitAccent("")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("files unknown document categories under other", () => {
    expect(categoryKey("decision")).toBe("docs.cat.decision");
    expect(categoryKey("press")).toBe("docs.cat.other");
  });

  it("shows a see-all link only when it has a target and a label", () => {
    const { rerender } = render(
      <MemoryRouter>
        <SectionTitle id="a" to="/news" linkLabel="All news">
          News
        </SectionTitle>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "All news" })).toHaveAttribute("href", "/news");

    rerender(
      <MemoryRouter>
        <SectionTitle id="a">News</SectionTitle>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("measures an element and ignores empty measures", () => {
    let report: ResizeObserverCallback = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          report = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );

    function Probe() {
      const [ref, width] = useElementWidth<HTMLDivElement>(500);
      return <div ref={ref}>{width}</div>;
    }
    const { unmount } = render(<Probe />);
    const entry = (width: number) =>
      [{ contentRect: { width } }] as unknown as ResizeObserverEntry[];

    act(() => {
      report(entry(0), {} as ResizeObserver);
    });
    expect(screen.getByText("500")).toBeInTheDocument();
    act(() => {
      report(entry(321.7), {} as ResizeObserver);
    });
    expect(screen.getByText("321")).toBeInTheDocument();

    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("keeps the fallback width when nothing is attached", () => {
    const { result } = renderHook(() => useElementWidth(640));
    expect(result.current[1]).toBe(640);
  });
});
