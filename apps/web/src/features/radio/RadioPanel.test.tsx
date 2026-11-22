import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

const race = `/sessions/${SESSION_ID}`;

async function radioPanel() {
  return screen.findByRole("region", { name: "Team radio" });
}

/** The whole session's radio, not only what was said by the replay time. */
async function showAll(panel: HTMLElement) {
  await userEvent.click(await within(panel).findByRole("button", { name: "Show all" }));
}

describe("RadioPanel", () => {
  it("lists the selected driver's radio with what was said", async () => {
    renderRoute(`${race}?car=4`);

    const panel = await radioPanel();
    await showAll(panel);
    expect(await within(panel).findByText(/Gap to Leclerc is three seconds/)).toBeVisible();
    expect(within(panel).getByText(/Don't box, we go to the end/)).toBeVisible();
    expect(within(panel).getByText("(uncertain)")).toBeVisible();
    expect(within(panel).getByText("No words recognised in this clip.")).toBeVisible();
    expect(within(panel).getByText("Transcription on its way.")).toBeVisible();
    expect(within(panel).queryByText("Box call")).not.toBeInTheDocument();
    expect(
      within(panel).getAllByRole("button", { name: /^Radio of NOR at \d\d:\d\d:\d\d UTC$/ }),
    ).toHaveLength(4);
  });

  it("plays one clip at a time with its own controls", async () => {
    let paused = true;
    const sources: string[] = [];
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      paused = false;
      sources.push(this.src);
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      paused = true;
      this.dispatchEvent(new Event("pause"));
    });
    renderRoute(`${race}?car=4`);
    const panel = await radioPanel();
    await showAll(panel);
    const [first] = await within(panel).findAllByRole("button", { name: /^Radio of NOR/ });

    if (!first) throw new Error("no radio button");
    await userEvent.click(first);

    expect(play).toHaveBeenCalledOnce();
    expect(sources[0]).toContain("LANNOR01_4_20250803_152104.mp3");
    const pause = await within(panel).findByRole("button", { name: "Pause the radio of NOR" });
    expect(pause).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByText("0:00")).toBeVisible();

    await userEvent.click(pause);

    expect(await within(panel).findAllByRole("button", { name: /^Radio of NOR/ })).toHaveLength(4);
  });

  it("shows every driver's radio and marks the calls to pit", async () => {
    const { router } = renderRoute(`${race}?car=4`);
    const panel = await radioPanel();
    await showAll(panel);
    await within(panel).findByText(/Gap to Leclerc/);

    await userEvent.click(within(panel).getByRole("button", { name: "Everyone" }));

    expect(await within(panel).findByText(/Box box, box this lap/)).toBeVisible();
    expect(within(panel).getByText("Box call")).toBeVisible();
    expect(router.state.location.search).toContain("radio=all");
  });

  it("moves the replay to the lap of a message", async () => {
    const { router } = renderRoute(`${race}?car=4&radio=all&lap=5`);
    const panel = await radioPanel();
    await showAll(panel);

    await userEvent.click(await within(panel).findByRole("button", { name: "Go to lap 31 (PIA)" }));

    const search = new URLSearchParams(router.state.location.search);
    expect(search.get("lap")).toBe("31");
    expect(search.get("car")).toBe("81");
    // Back on the replay clock, the message has just been sent.
    await userEvent.click(within(panel).getByRole("button", { name: "Follow the replay" }));
    expect(within(panel).getByText(/Box box, box this lap/)).toBeVisible();
    expect(within(panel).getByText("New")).toBeVisible();
  });

  it("only shows what was said by the replay time, newest first", async () => {
    renderRoute(`${race}?car=4&radio=all&lap=40`);
    const panel = await radioPanel();

    expect(await within(panel).findByText(/Box box, box this lap/)).toBeVisible();
    const said = within(panel)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(said[0]).toContain("Box box");
    expect(said[1]).toContain("Gap to Leclerc");
    expect(within(panel).queryByText(/Don't box/)).not.toBeInTheDocument();
    expect(within(panel).getByText("3 messages to come")).toBeVisible();
  });

  it("waits for a driver's first message", async () => {
    renderRoute(`${race}?car=4&lap=5`);
    const panel = await radioPanel();

    expect(
      await within(panel).findByText("No team radio yet at this point of the replay."),
    ).toBeVisible();
    expect(within(panel).getByText("4 messages to come")).toBeVisible();
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
