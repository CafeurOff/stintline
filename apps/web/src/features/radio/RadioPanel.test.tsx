import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

const race = `/sessions/${SESSION_ID}`;

async function radioPanel() {
  return screen.findByRole("region", { name: "Team radio" });
}

describe("RadioPanel", () => {
  it("lists the selected driver's radio with what was said", async () => {
    renderRoute(`${race}?car=4`);

    const panel = await radioPanel();
    expect(await within(panel).findByText(/Gap to Leclerc is three seconds/)).toBeVisible();
    expect(within(panel).getByText(/Don't box, we go to the end/)).toBeVisible();
    expect(within(panel).getByText("(uncertain)")).toBeVisible();
    expect(within(panel).getByText("No words recognised in this clip.")).toBeVisible();
    expect(within(panel).getByText("Transcription on its way.")).toBeVisible();
    expect(within(panel).queryByText("Box call")).not.toBeInTheDocument();
    expect(within(panel).getAllByLabelText(/^Radio of NOR at \d\d:\d\d:\d\d UTC$/)).toHaveLength(4);
  });

  it("shows every driver's radio and marks the calls to pit", async () => {
    const { router } = renderRoute(`${race}?car=4`);
    const panel = await radioPanel();
    await within(panel).findByText(/Gap to Leclerc/);

    await userEvent.click(within(panel).getByRole("button", { name: "Everyone" }));

    expect(await within(panel).findByText(/Box box, box this lap/)).toBeVisible();
    expect(within(panel).getByText("Box call")).toBeVisible();
    expect(router.state.location.search).toContain("radio=all");
  });

  it("moves the replay to the lap of a message", async () => {
    const { router } = renderRoute(`${race}?car=4&radio=all&lap=5`);
    const panel = await radioPanel();

    await userEvent.click(await within(panel).findByRole("button", { name: "Go to lap 31 (PIA)" }));

    const search = new URLSearchParams(router.state.location.search);
    expect(search.get("lap")).toBe("31");
    expect(search.get("car")).toBe("81");
  });

  it("says when a driver sent no radio", async () => {
    server.use(http.get("*/api/v1/sessions/:id/radio", () => HttpResponse.json([])));
    renderRoute(`${race}?car=4`);

    const panel = await radioPanel();

    expect(
      await within(panel).findByText("No team radio from Lando Norris in this session."),
    ).toBeVisible();
  });

  it("offers a retry when the radio cannot be loaded", async () => {
    server.use(http.get("*/api/v1/sessions/:id/radio", () => problem(500, "server_error", "Boom")));
    renderRoute(`${race}?car=4`);

    const panel = await radioPanel();

    expect(await within(panel).findByRole("alert")).toBeVisible();
    expect(within(panel).getByRole("button", { name: /retry/i })).toBeVisible();
  });
});
