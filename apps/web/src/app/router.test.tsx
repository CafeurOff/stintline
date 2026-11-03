import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

describe("routes", () => {
  it("renders the home page inside the layout", async () => {
    renderRoute("/");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Race strategy, lap by lap.",
    );
    expect(screen.getByRole("link", { name: "StintLine" })).toBeInTheDocument();
    expect(screen.getByText(/not associated with Formula 1/)).toBeInTheDocument();
  });

  it("renders a not-found page with a way back home", async () => {
    renderRoute("/does-not-exist");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Back to home" }));
    expect(await screen.findByText("Race strategy, lap by lap.")).toBeInTheDocument();
  });

  it("offers a skip link to the main content", () => {
    renderRoute("/");

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });
});
