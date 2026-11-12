import { render, screen } from "@testing-library/react";

import { App } from "./App";

describe("App", () => {
  it("boots with its providers", async () => {
    render(<App />);

    // The rail (desktop) and the top bar (phones) each carry the brand; CSS shows one.
    const brand = await screen.findAllByRole("link", { name: "StintLine" });
    expect(brand[0]).toBeVisible();
  });
});
