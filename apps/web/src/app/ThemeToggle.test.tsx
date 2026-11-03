import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";
import { renderRoute } from "@/test/render";

describe("ThemeToggle", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("defaults to the dark theme", () => {
    expect(readStoredTheme()).toBe("dark");
  });

  it("switches to light and remembers the choice", async () => {
    renderRoute("/model");

    await userEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredTheme()).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });
});
