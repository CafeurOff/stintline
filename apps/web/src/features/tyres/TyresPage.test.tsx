import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderRoute } from "@/test/render";
import { SESSION_ID } from "@/test/server";

const path = `/sessions/${SESSION_ID}/tyres`;

describe("TyresPage", () => {
  it("says how fast each compound wears, softest first", async () => {
    renderRoute(path);

    const items = await within(await screen.findByRole("main")).findAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/Softs\s*lose 101\sms per lap/);
    expect(items[2]).toHaveTextContent(/Hards\s*lose 45\sms per lap/);
  });

  it("lists who ran what, in finishing order", async () => {
    renderRoute(path);

    const strategies = await screen.findByRole("region", { name: "Who ran what" });
    const [first] = await within(strategies).findAllByRole("listitem");
    if (!first) throw new Error("no strategy rows");
    expect(first).toHaveTextContent("NOR");
    expect(within(first).getByRole("img", { name: "Medium 1–31" })).toBeVisible();
  });

  it("draws the podium by default and toggles drivers through the URL", async () => {
    const { router } = renderRoute(path);
    expect(await screen.findByRole("checkbox", { name: /NOR/ })).toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: /NOR/ }));

    expect(screen.getByRole("checkbox", { name: /NOR/ })).not.toBeChecked();
    expect(router.state.location.search).toContain("cars=81%2C16");
    const chart = screen.getByRole("img", { name: /lap time by tyre age for/ });
    expect(chart).toHaveAccessibleName(expect.stringMatching(/PIA/));
    expect(chart).not.toHaveAccessibleName(expect.stringMatching(/NOR/));
  });

  it("keeps at least one driver on the chart", async () => {
    renderRoute(`${path}?cars=4`);

    expect(await screen.findByRole("checkbox", { name: /NOR/ })).toBeDisabled();
  });

  it("speaks French", async () => {
    renderRoute(path, { locale: "fr" });

    expect(await screen.findByText("Durs")).toBeVisible();
    expect(screen.getByRole("region", { name: "Qui a roulé avec quoi" })).toBeVisible();
  });
});
