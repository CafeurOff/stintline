import type { Schema } from "@stintline/api-types";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { pitExit } from "@/test/fixtures/pitExit";
import { undercut } from "@/test/fixtures/undercut";
import { renderRoute } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

const path = `/sessions/${SESSION_ID}/simulator`;

function recordBodies<T>(endpoint: string, response: object) {
  const bodies: T[] = [];
  server.use(
    http.post(`*/api/v1/sessions/:id/simulate/${endpoint}`, async ({ request }) => {
      bodies.push((await request.json()) as T);
      return HttpResponse.json(response);
    }),
  );
  return bodies;
}

describe("UndercutSimulator", () => {
  it("defaults to P2 attacking P1 and shows the verdict", async () => {
    const bodies = recordBodies<Schema<"UndercutRequestRequest">>("undercut", undercut);
    renderRoute(path);

    const card = await screen.findByRole("region", { name: "Undercut / overcut" });
    expect(await within(card).findByText("The undercut fails")).toBeVisible();
    expect(bodies[0]).toMatchObject({ attacker: 81, defender: 4, stop_lap: 21 });
    expect(within(card).getByRole("img", { name: /Gap to the defender by lap/ })).toBeVisible();
  });

  it("re-simulates when the stop lap slider moves", async () => {
    const bodies = recordBodies<Schema<"UndercutRequestRequest">>("undercut", undercut);
    renderRoute(path);
    const card = await screen.findByRole("region", { name: "Undercut / overcut" });
    await within(card).findByText("The undercut fails");

    const slider = within(card).getByRole("slider", { name: "Attacker's stop lap" });
    fireEvent.change(slider, { target: { value: "30" } });

    expect(slider).toHaveAttribute("aria-valuetext", "Lap 30 of 70");
    await vi.waitFor(() => {
      expect(bodies.at(-1)).toMatchObject({ stop_lap: 30 });
    });
  });

  it("sends every control's value in the request", async () => {
    const bodies = recordBodies<Schema<"UndercutRequestRequest">>("undercut", undercut);
    renderRoute(path);
    const card = await screen.findByRole("region", { name: "Undercut / overcut" });
    await within(card).findByText("The undercut fails");

    await userEvent.selectOptions(within(card).getByLabelText("Attacker"), "16");
    await userEvent.selectOptions(within(card).getByLabelText("Defender"), "81");
    await userEvent.selectOptions(within(card).getByLabelText("Attacker's new tyres"), "SOFT");
    await userEvent.selectOptions(within(card).getByLabelText("Defender's new tyres"), "MEDIUM");
    fireEvent.change(within(card).getByRole("slider", { name: "Defender reacts after" }), {
      target: { value: "3" },
    });

    await vi.waitFor(() => {
      expect(bodies.at(-1)).toEqual({
        attacker: 16,
        defender: 81,
        stop_lap: 21,
        attacker_compound: "SOFT",
        defender_compound: "MEDIUM",
        defender_reaction_laps: 3,
      });
    });
  });

  it("refuses the same driver on both sides", async () => {
    renderRoute(`${path}?attacker=4&defender=4`);

    const card = await screen.findByRole("region", { name: "Undercut / overcut" });
    expect(within(card).getByRole("alert")).toHaveTextContent("Pick two different drivers.");
  });

  it("shows the API problem when a simulation is rejected", async () => {
    server.use(
      http.post("*/api/v1/sessions/:id/simulate/undercut", () =>
        problem(422, "simulation_error", "Simulation error", "Car 81 is not running on lap 21."),
      ),
    );
    renderRoute(path);

    const card = await screen.findByRole("region", { name: "Undercut / overcut" });
    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "Car 81 is not running on lap 21.",
    );
  });
});

describe("PitExitSimulator", () => {
  it("predicts the rejoin position with its interval", async () => {
    renderRoute(path);

    const card = await screen.findByRole("region", { name: "Pit-exit position" });
    expect(await within(card).findByText("90% interval P4–P5")).toBeVisible();
    expect(within(card).getByText("Rejoins").nextElementSibling).toHaveTextContent("P5");
    expect(within(card).getByRole("img", { name: /P4 37%, P5 63%/ })).toBeVisible();
  });

  it("lists the close fights at the pit exit", async () => {
    renderRoute(path);

    const card = await screen.findByRole("region", { name: "Pit-exit position" });
    const table = await within(card).findByRole("table", { name: "Close fights at the pit exit" });
    expect(within(table).getByRole("row", { name: /^HAM|^ALO|^SAI|^STR|^LEC|^RUS/ })).toBeVisible();
  });

  it("sends the safety-car condition", async () => {
    const bodies = recordBodies<Schema<"PitExitRequestRequest">>("pit-exit", pitExit);
    renderRoute(path);
    const card = await screen.findByRole("region", { name: "Pit-exit position" });
    await within(card).findByText("90% interval P4–P5");

    await userEvent.click(within(card).getByRole("radio", { name: "Safety car" }));

    await vi.waitFor(() => {
      expect(bodies.at(-1)).toMatchObject({ car: 4, pit_lap: 35, neutralisation: "SC" });
    });
  });

  it("explains throttling", async () => {
    server.use(
      http.post("*/api/v1/sessions/:id/simulate/pit-exit", () =>
        problem(429, "throttled", "Request was throttled."),
      ),
    );
    renderRoute(path);

    const card = await screen.findByRole("region", { name: "Pit-exit position" });
    expect(await within(card).findByRole("alert")).toHaveTextContent(/Too many simulations/);
  });
});
