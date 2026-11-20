import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

describe("Race pace controls", () => {
  it("applies every pace filter to the URL", async () => {
    const { router } = renderRoute("/analysis/pace");

    await waitFor(() => {
      expect(document.title).toMatch(/^Race pace: /);
    });
    const pit = screen.getByRole("group", { name: "Pit laps" });
    await userEvent.click(within(pit).getByRole("radio", { name: "Show" }));
    const sc = screen.getByRole("group", { name: "Safety-car laps" });
    await userEvent.click(within(sc).getByRole("radio", { name: "Show" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Cut-off" }), "0");

    const search = router.state.location.search;
    expect(search).toContain("pit=1");
    expect(search).toContain("sc=1");
    expect(search).toContain("cutoff=0");

    await userEvent.click(within(sc).getByRole("radio", { name: "Hide" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Cut-off" }), "107");
    expect(router.state.location.search).not.toContain("cutoff");
    expect(router.state.location.search).not.toContain("sc=");
  });

  it("picks the drivers drawn on the pace charts", async () => {
    const { router } = renderRoute("/analysis/pace?session=70");

    const ranking = await screen.findByRole("table", { name: "Pace ranking" });
    const boxes = within(ranking).getAllByRole("checkbox");
    const unticked = boxes.find((box) => !(box as HTMLInputElement).checked);
    const ticked = boxes.find((box) => (box as HTMLInputElement).checked);
    if (!ticked || !unticked) throw new Error("expected ticked and unticked drivers");

    await userEvent.click(ticked);
    await userEvent.click(unticked);

    expect(router.state.location.search).toContain("drivers=");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Race" }), "70");
    expect(router.state.location.search).toContain("session=70");
  });

  it("explains that pace needs timing before 2023", async () => {
    renderRoute("/analysis/pace?season=2010");

    expect(await screen.findByText("Lap timing exists from 2023.")).toBeVisible();
  });
});
