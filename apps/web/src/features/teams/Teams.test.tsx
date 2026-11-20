import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

describe("Team pages", () => {
  it("lists teams and shows a team's record", async () => {
    renderRoute("/teams");
    await userEvent.click(await screen.findByRole("link", { name: /McLaren/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "McLaren" })).toBeVisible();
    expect(screen.getByLabelText("Team in numbers")).toHaveTextContent("Constructors' titles");
  });

  it("searches teams by name", async () => {
    const { router } = renderRoute("/teams");

    await userEvent.type(await screen.findByRole("searchbox", { name: "Search a team" }), "ferr");

    expect(router.state.location.search).toBe("?q=ferr");
    expect(await screen.findByRole("link", { name: /Ferrari/ })).toBeVisible();
  });

  it("shows a not-found page for an unknown team", async () => {
    renderRoute("/teams/nobody");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
