import type { Schema } from "@stintline/api-types";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { server, SESSION_ID, strategyResponse } from "@/test/server";

const race = `/sessions/${SESSION_ID}?lap=30&car=81&mode=strategy`;

function panel() {
  return screen.getByRole("complementary");
}

async function loaded() {
  await screen.findByRole("complementary");
}

describe("What-if strategy mode", () => {
  it("starts from the strategy the driver really ran", async () => {
    renderRoute(race);
    await loaded();

    expect(
      await within(panel()).findByRole("heading", {
        name: "What if Piastri had run another strategy?",
      }),
    ).toBeVisible();
    const starting = within(panel()).getByRole("group", { name: "Starting tyres" });
    expect(within(starting).getByRole("radio", { name: /Medium/ })).toBeChecked();
    expect(within(panel()).getAllByRole("group", { name: /^Stop \d$/ }).length).toBeGreaterThan(0);
  });

  it("keeps the edited plan in the address and replays the race with it", async () => {
    const bodies: Schema<"StrategyRequestRequest">[] = [];
    server.use(
      http.post("*/api/v1/sessions/:id/simulate/strategy", async ({ request }) => {
        const body = (await request.json()) as Schema<"StrategyRequestRequest">;
        bodies.push(body);
        return HttpResponse.json(strategyResponse(body));
      }),
    );
    const { router } = renderRoute(race);
    await loaded();

    const starting = await within(panel()).findByRole("group", { name: "Starting tyres" });
    await userEvent.click(within(starting).getByRole("radio", { name: /Hard/ }));
    expect(router.state.location.search).toMatch(/plan=H/);

    await userEvent.click(within(panel()).getByRole("button", { name: "Replay the race" }));

    const result = await within(panel()).findByRole("region", { name: "Result of the replay" });
    expect(within(result).getByText("Piastri would finish 1st instead of 2nd.")).toBeVisible();
    expect(within(result).getByText(/2\.5\ss quicker over the whole race/)).toBeVisible();
    expect(within(result).getByText(/25 points instead of 18/)).toBeVisible();
    expect(within(result).getByText(/longer than any run on that compound/)).toBeVisible();
    expect(bodies[0]?.start_compound).toBe("HARD");
    expect(bodies[0]?.car).toBe(81);
  });

  it("adds and removes stops and refuses stints that are too short", async () => {
    const { router } = renderRoute(race);
    await loaded();
    const before = (await within(panel()).findAllByRole("group", { name: /^Stop \d$/ })).length;

    await userEvent.click(within(panel()).getByRole("button", { name: "+ Add a stop" }));
    expect(within(panel()).getAllByRole("group", { name: /^Stop \d$/ })).toHaveLength(before + 1);

    const last = within(panel()).getByRole("spinbutton", {
      name: `Stop ${String(before + 1)} on lap`,
    });
    await userEvent.clear(last);
    await userEvent.type(last, "69");
    expect(within(panel()).getByRole("alert")).toHaveTextContent(/at least 3 laps/);
    expect(within(panel()).getByRole("button", { name: "Replay the race" })).toBeDisabled();

    await userEvent.click(
      within(panel()).getByRole("button", { name: `Remove stop ${String(before + 1)}` }),
    );
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Back to the real strategy" }),
    );
    expect(router.state.location.search).not.toContain("plan=");
  });

  it("moves a stop one lap at a time", async () => {
    const { router } = renderRoute(race);
    await loaded();

    const [later] = await within(panel()).findAllByRole("button", { name: "One lap later" });
    if (!later) throw new Error("no stop to move");
    await userEvent.click(later);

    expect(router.state.location.search).toContain("plan=");
  });
});
