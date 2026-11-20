import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

import { isRailShortcut, RAIL_STORAGE_KEY, readStoredRail } from "./rail";

describe("collapsible sidebar", () => {
  afterEach(() => {
    delete document.documentElement.dataset.rail;
    localStorage.clear();
  });

  it("reduces the sidebar to icons, remembers it and expands it again", async () => {
    renderRoute("/");
    const button = await screen.findByRole("button", { name: "Reduce the menu" });

    await userEvent.click(button);

    expect(document.documentElement.dataset.rail).toBe("collapsed");
    expect(localStorage.getItem(RAIL_STORAGE_KEY)).toBe("collapsed");
    expect(readStoredRail()).toBe("collapsed");
    const expand = screen.getByRole("button", { name: "Expand the menu" });
    expect(expand).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(expand);
    expect(document.documentElement.dataset.rail).toBeUndefined();
    expect(readStoredRail()).toBe("full");
  });

  it("names an icon beside it when the sidebar is reduced", async () => {
    renderRoute("/");
    await userEvent.click(await screen.findByRole("button", { name: "Reduce the menu" }));
    const rail = document.getElementById("site-rail");
    const link = rail?.querySelector('a[href="/standings"]');
    if (!link) throw new Error("no standings link in the rail");

    fireEvent.mouseEnter(link);
    expect(screen.getAllByText("Standings").length).toBeGreaterThan(1);
    fireEvent.mouseLeave(link);
  });

  it("toggles with [ but not while typing", async () => {
    renderRoute("/");
    await screen.findByRole("button", { name: "Reduce the menu" });

    fireEvent.keyDown(window, { key: "[" });
    expect(document.documentElement.dataset.rail).toBe("collapsed");

    const input = document.createElement("input");
    document.body.append(input);
    expect(isRailShortcut(new KeyboardEvent("keydown", { key: "[" }))).toBe(true);
    const typed = new KeyboardEvent("keydown", { key: "[" });
    Object.defineProperty(typed, "target", { value: input });
    expect(isRailShortcut(typed)).toBe(false);
    expect(isRailShortcut(new KeyboardEvent("keydown", { key: "[", ctrlKey: true }))).toBe(false);
    input.remove();
  });

  it("falls back to the full sidebar when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredRail()).toBe("full");
  });
});
