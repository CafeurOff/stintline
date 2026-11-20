import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

describe("About and credits", () => {
  it("credits every source and says what is kept about readers", async () => {
    renderRoute("/about");

    expect(
      await screen.findByRole("heading", { name: "About and credits", level: 1 }),
    ).toBeVisible();
    const data = screen.getByRole("region", { name: "Data and pictures" });
    expect(within(data).getByRole("link", { name: "OpenF1" })).toHaveAttribute(
      "href",
      "https://openf1.org",
    );
    expect(within(data).getByText("CC BY 4.0")).toBeVisible();
    expect(screen.getByText("No cookies, no advertising and no tracker.")).toBeVisible();
  });

  it("is linked from the footer of every page", async () => {
    const { router } = renderRoute("/model");

    const footer = await screen.findByRole("contentinfo");
    await userEvent.click(within(footer).getByRole("link", { name: "About and credits" }));

    expect(router.state.location.pathname).toBe("/about");
  });
});
