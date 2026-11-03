import { render, screen } from "@testing-library/react";

import { App } from "./App";

describe("App", () => {
  it("boots with its providers", async () => {
    render(<App />);

    expect(await screen.findByRole("link", { name: "StintLine" })).toBeVisible();
  });
});
