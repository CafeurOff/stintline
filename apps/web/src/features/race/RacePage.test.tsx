import type { Schema } from "@stintline/api-types";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { pitExit } from "@/test/fixtures/pitExit";
import { renderRoute } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

const race = `/sessions/${SESSION_ID}`;

function panel() {
  return screen.getByRole("complementary");
}

describe("RacePage", () => {
  it("draws every car on the circuit at the requested lap", async () => {
    renderRoute(`${race}?lap=30`);

    const map = await screen.findByRole("group", { name: /Hungaroring: cars on track, lap 30/ });
    expect(within(map).getAllByRole("button")).toHaveLength(20);
    expect(screen.getByText("Lap 30")).toBeVisible();
  });

  it("explains where the selected driver rejoins after a stop", async () => {
    const bodies: Schema<"PitExitRequestRequest">[] = [];
    server.use(
      http.post("*/api/v1/sessions/:id/simulate/pit-exit", async ({ request }) => {
        bodies.push((await request.json()) as Schema<"PitExitRequestRequest">);
        return HttpResponse.json(pitExit);
      }),
    );
    renderRoute(`${race}?lap=30&car=4`);

    await userEvent.click(await screen.findByRole("button", { name: "Simulate the stop" }));

    expect((await within(panel()).findByText("at the pit exit")).parentElement).toHaveTextContent(
      "5th at the pit exit",
    );
    expect(
      within(panel()).getByText(
        /NOR would lose about 21\ss and rejoin between ALO \(1\.0\ss ahead\) and BOR \(7\.3\ss behind\)/,
      ),
    ).toBeVisible();
    expect(within(panel()).getByText(/Close with ALO/)).toBeVisible();
    expect(bodies).toEqual([{ car: 4, pit_lap: 30 }]);
  });

  it("clears the result on request", async () => {
    renderRoute(`${race}?lap=30&car=4`);
    await userEvent.click(await screen.findByRole("button", { name: "Simulate the stop" }));
    await within(panel()).findByText("at the pit exit");

    await userEvent.click(within(panel()).getByRole("button", { name: "Clear" }));

    expect(within(panel()).getByRole("button", { name: "Simulate the stop" })).toBeVisible();
  });

  it("selects a driver by clicking their car", async () => {
    const { router } = renderRoute(`${race}?lap=30`);
    const map = await screen.findByRole("group", { name: /cars on track/ });

    await userEvent.click(within(map).getByRole("button", { name: "Oscar Piastri" }));

    expect(within(panel()).getByText("What if Piastri pitted now?")).toBeVisible();
    expect(router.state.location.search).toContain("car=81");
  });

  it("moves the replay with the lap slider", async () => {
    renderRoute(`${race}?lap=30`);
    const slider = await screen.findByRole("slider", { name: "Lap" });

    fireEvent.change(slider, { target: { value: "50" } });

    expect(await screen.findByRole("group", { name: /lap 50/ })).toBeVisible();
    expect(slider).toHaveAttribute("aria-valuetext", "Lap 50 of 70");
  });

  it("simulates an undercut on the car ahead", async () => {
    renderRoute(`${race}?lap=30&car=81&mode=undercut`);

    expect(
      await within(await screen.findByRole("complementary")).findByText(
        "Can Oscar Piastri undercut Charles Leclerc?",
      ),
    ).toBeVisible();
    await userEvent.click(within(panel()).getByText("Soft"));
    await userEvent.click(within(panel()).getByRole("button", { name: "Simulate the undercut" }));

    expect(await within(panel()).findByText("PIA would stay behind")).toBeVisible();
    expect(within(panel()).getByText(/Chance of coming out ahead: <1%/)).toBeVisible();
  });

  it("says when there is nobody to undercut", async () => {
    renderRoute(`${race}?lap=30&car=4&mode=undercut`);

    expect(
      await within(await screen.findByRole("complementary")).findByText(
        "Lando Norris is leading: there is no car ahead to undercut.",
      ),
    ).toBeVisible();
  });

  it("refuses a stop on the first lap", async () => {
    renderRoute(`${race}?lap=1&car=4`);

    expect(
      await within(await screen.findByRole("complementary")).findByText(/cannot stop on this lap/),
    ).toBeVisible();
  });

  it("works without a circuit drawing", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/track", () => problem(404, "not_found", "Not found")),
    );
    renderRoute(race);

    expect(await screen.findByText(/No circuit drawing for this race/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Simulate the stop" })).toBeVisible();
  });

  it("shows simulation errors with a retry", async () => {
    server.use(
      http.post("*/api/v1/sessions/:id/simulate/pit-exit", () =>
        problem(429, "throttled", "Request was throttled."),
      ),
    );
    renderRoute(`${race}?lap=30&car=4`);

    await userEvent.click(await screen.findByRole("button", { name: "Simulate the stop" }));

    expect(await within(panel()).findByRole("alert")).toHaveTextContent(/Too many simulations/);
  });

  it("shows the not-found page for an unknown or malformed race", async () => {
    renderRoute("/sessions/999");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("offers a retry when the replay fails", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/replay", () => problem(500, "error", "Server error")),
    );
    renderRoute(race);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });

  it("speaks French", async () => {
    renderRoute(`${race}?lap=30&car=4`, { locale: "fr" });

    await userEvent.click(await screen.findByRole("button", { name: "Simuler l'arrêt" }));

    expect(
      (await within(panel()).findByText("à la sortie des stands")).parentElement,
    ).toHaveTextContent("5e à la sortie des stands");
    expect(within(panel()).getByText(/ressortirait entre ALO \(1,0\ss devant\)/)).toBeVisible();
  });
});

describe("Replay controls", () => {
  it("plays, pauses and changes speed", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
    renderRoute(`${race}?lap=30`);

    const pause = await screen.findByRole("button", { name: "Pause" });
    const leader = screen.getByRole("button", { name: "Lando Norris" });
    const before = leader.getAttribute("transform");
    await userEvent.click(screen.getByRole("button", { name: "×30" }));
    expect(screen.getByRole("button", { name: "×30" })).toHaveAttribute("aria-pressed", "true");
    await vi.waitFor(() => {
      expect(leader.getAttribute("transform")).not.toBe(before);
    });

    await userEvent.click(pause);

    expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
    vi.unstubAllGlobals();
  });
});
