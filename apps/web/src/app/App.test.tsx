import { render, screen } from "@testing-library/react";

import { App } from "./App";

describe("App", () => {
  it("boots with the browser router and query client", async () => {
    render(<App />);

    expect(await screen.findByText("Race strategy, lap by lap.")).toBeInTheDocument();
  });
});
