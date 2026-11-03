import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";

describe("Race analysis on the Grand Prix page", () => {
  it("sums the race up in a few facts", async () => {
    renderRoute("/events/14");

    const facts = await screen.findByRole("list", { name: "Key facts" });
    expect(within(facts).getByText(/Lando Norris wins/)).toBeVisible();
    expect(within(facts).getByText(/Fastest lap:/)).toBeVisible();
    expect(await within(facts).findByText(/pit stops in total/)).toBeVisible();
  });

  it("draws positions lap by lap with the podium highlighted", async () => {
    renderRoute("/events/14");

    expect(
      await screen.findByRole("img", { name: "Position of each driver at the end of every lap" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Lando Norris" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("highlights another driver and keeps the choice in the address", async () => {
    const { router } = renderRoute("/events/14");

    await userEvent.click(await screen.findByRole("button", { name: "Fernando Alonso" }));

    expect(router.state.location.search).toContain("drivers=");
    expect(router.state.location.search).toContain("14");
  });

  it.each([
    ["Gaps", "Gap of each driver to the leader at the end of every lap"],
    ["Lap times", "Lap times of the highlighted drivers"],
  ])("switches to the %s chart", async (tab, label) => {
    renderRoute("/events/14");

    await userEvent.click(await screen.findByRole("radio", { name: tab }));

    expect(await screen.findByRole("img", { name: label })).toBeVisible();
  });

  it("shows the field's tyre strategies", async () => {
    renderRoute("/events/14?chart=tyres");

    expect(await screen.findByText("* started on used tyres")).toBeVisible();
  });

  it("ranks best laps, sectors and top speeds", async () => {
    renderRoute("/events/14?chart=sectors");

    expect(await screen.findByRole("columnheader", { name: "Ideal lap" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Top speed" })).toBeVisible();
  });
});
