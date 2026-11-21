import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { events } from "@/test/fixtures/events";
import { liveSnapshot } from "@/test/fixtures/live";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

/** Minimal stand-in for the browser WebSocket: tests push messages by hand. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  close() {
    this.onclose?.();
  }
}

/** The line under the title: lap count, track status and connection. */
function statusLine(lap: HTMLElement): HTMLElement {
  const line = lap.parentElement;
  if (!line) throw new Error("lap count outside its line");
  return line;
}

function goLive() {
  server.use(
    http.get("*/api/v1/live", () =>
      HttpResponse.json({ state: "live", snapshot: liveSnapshot, next_session: null }),
    ),
  );
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Live page", () => {
  it("counts down to the next session without technical instructions", async () => {
    renderRoute("/live");

    const main = within(await screen.findByRole("main"));
    expect(await main.findByRole("heading", { name: "No live session right now" })).toBeVisible();
    expect(main.getByRole("link", { name: "Hungarian Grand Prix" })).toHaveAttribute(
      "href",
      "/events/14",
    );
    expect(main.getByText(/Practice 1/)).toBeVisible();
    expect(main.getByRole("timer")).toBeVisible();
    expect(screen.queryByText("make live")).toBeNull();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("says a session is running when the schedule says so but no live data comes", async () => {
    const started = new Date(Date.now() - 30 * 60_000).toISOString();
    server.use(
      http.get("*/api/v1/events/:id", () =>
        HttpResponse.json({
          ...events.results[0],
          sessions: [{ id: 1, kind: "R", scheduled_start: started, has_data: false }],
        }),
      ),
    );
    renderRoute("/live");

    expect(await screen.findByRole("heading", { name: "A session is running" })).toBeVisible();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("shows the running order, the circuit and the race control", async () => {
    goLive();
    renderRoute("/live");

    expect(await screen.findByRole("heading", { name: "Mexico City Grand Prix" })).toBeVisible();
    expect(screen.getByText("Lap 71/71")).toBeVisible();
    expect(screen.getByText("Green flag")).toBeVisible();
    const order = screen.getByRole("table", { name: "Running order" });
    expect(within(order).getAllByRole("row")).toHaveLength(5);
    expect(within(order).getByText("Leader")).toBeVisible();
    expect(await screen.findByRole("group", { name: /cars on track now/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Race control" })).toBeVisible();
  });

  it("colours mini-sectors and shows places won since the start", async () => {
    goLive();
    renderRoute("/live");

    const order = await screen.findByRole("table", { name: "Running order" });
    const verstappen = within(order).getByRole("row", { name: /VER/ });
    expect(within(verstappen).getByText("Sector 1", { exact: false })).toBeInTheDocument();
    expect(within(verstappen).getByText("(Fastest overall)")).toBeInTheDocument();
    expect(
      within(order).getByRole("columnheader", { name: "Places won since the start" }),
    ).toBeInTheDocument();
    expect(within(verstappen).getByText("places gained")).toBeInTheDocument();
    expect(screen.getByText("Personal best")).toBeVisible();
  });

  it("draws the flag periods of the race on a timeline", async () => {
    goLive();
    renderRoute("/live");

    const timeline = await screen.findByRole("region", { name: "Race timeline" });
    expect(within(timeline).getByText("Virtual safety car")).toBeVisible();
    expect(within(timeline).getByText("laps 6–8")).toBeVisible();
    expect(within(timeline).getByText("lap 41")).toBeVisible();
  });

  it("averages the pit-lane times and shows the weather lap by lap", async () => {
    goLive();
    renderRoute("/live");

    const pits = await screen.findByRole("region", { name: "Pit lane" });
    expect(within(pits).getByText("4")).toBeVisible();
    expect(within(pits).getByText("Quickest teams on average")).toBeVisible();
    const weather = screen.getByRole("region", { name: "Weather at the track" });
    expect(within(weather).getByText(/38\.2 °C on lap 1, 33\.9 °C on lap 71/)).toBeVisible();
    expect(within(weather).getByText(/Blue marks: rain/)).toBeVisible();
  });

  it("tags race control messages with their lap", async () => {
    goLive();
    renderRoute("/live");

    const side = await screen.findByRole("complementary");
    expect(within(side).getAllByText("L71")[0]).toBeVisible();
    expect(within(side).getAllByText("Stewards")).toHaveLength(2);
  });

  it("draws every car around the lap with the selected car's rejoin window", async () => {
    goLive();
    renderRoute("/live?car=44");

    const ring = await screen.findByRole("img", { name: /Every car around one lap/ });
    expect(within(ring).getByText("HAM")).toBeInTheDocument();
    expect(screen.getByText(/where HAM would rejoin after a stop/)).toBeVisible();
  });

  it("says where the selected driver would rejoin after a stop", async () => {
    goLive();
    const { router } = renderRoute("/live");

    await userEvent.click(await screen.findByRole("button", { name: /HAM/ }));

    expect(router.state.location.search).toBe("?car=44");
    const side = screen.getByRole("complementary");
    expect(within(side).getByRole("heading", { name: "If Hamilton pitted now?" })).toBeVisible();
    expect(within(side).getByText("Rejoins 12th")).toBeVisible();
  });

  it("plays team radio from the official recordings with what was said", async () => {
    goLive();
    renderRoute("/live");

    const sources: string[] = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      sources.push(this.src);
      return Promise.resolve();
    });

    const [first] = await screen.findAllByRole("button", { name: /^Radio of / });
    if (!first) throw new Error("no radio button");
    await userEvent.click(first);

    expect(sources[0]).toContain("livetiming.formula1.com/static/");
    expect(screen.getByText("Box box, box this lap.")).toBeVisible();
    expect(screen.getByText("Transcription on its way.")).toBeVisible();
  });

  it("follows the snapshots pushed over the socket and remembers the TV delay", async () => {
    goLive();
    renderRoute("/live");
    await screen.findByText("Lap 71/71");
    await vi.waitFor(() => {
      expect(FakeSocket.instances).toHaveLength(1);
    });

    act(() => {
      FakeSocket.instances[0]?.emit({
        ...liveSnapshot,
        lap: 12,
        track_status: "safety_car",
      });
    });

    const lap = await screen.findByText("Lap 12/71");
    expect(lap).toBeVisible();
    expect(within(statusLine(lap)).getByText("Safety car")).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "30 s" }));
    expect(localStorage.getItem("stintline-tv-delay")).toBe("30");
    expect(FakeSocket.instances[0]?.url).toMatch(/^ws:\/\/.+\/ws\/live$/);
  });

  it("shows a finished session without the delay control or the pit question", async () => {
    server.use(
      http.get("*/api/v1/live", () =>
        HttpResponse.json({ state: "finished", snapshot: liveSnapshot, next_session: null }),
      ),
    );
    renderRoute("/live");

    expect(await screen.findByText(/^Session over/)).toBeVisible();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /pitted now/ })).not.toBeInTheDocument();
  });

  it("flags cars in the pit, retired or lapped, and admits an unknown pit loss", async () => {
    const [leader, second, third, fourth] = liveSnapshot.cars;
    server.use(
      http.get("*/api/v1/live", () =>
        HttpResponse.json({
          state: "live",
          next_session: null,
          snapshot: {
            ...liveSnapshot,
            track_status: "red",
            pit_loss_s: null,
            pit_loss_sigma_s: null,
            cars: [
              leader,
              { ...second, in_pit: true },
              { ...third, retired: true, position: null, compound: null, tyre_age: null },
              { ...fourth, laps_behind: 2, last_lap_s: null },
            ],
          },
        }),
      ),
    );
    const { router } = renderRoute("/live");

    const order = await screen.findByRole("table", { name: "Running order" });
    expect(within(statusLine(screen.getByText("Lap 71/71"))).getByText("Red flag")).toBeVisible();
    expect(within(order).getByText("PIT")).toBeVisible();
    expect(within(order).getByText("OUT")).toBeVisible();
    expect(within(order).getByText("+2 laps")).toBeVisible();
    const side = screen.getByRole("complementary");
    expect(within(side).getByText(/No pit loss known/)).toBeVisible();

    await userEvent.click(within(order).getByRole("button", { name: /HAM/ }));
    expect(router.state.location.search).toBe("?car=44");
    expect(within(side).getByText(/HAM is in the pit lane/)).toBeVisible();
  });

  it("reconnects when the socket closes", async () => {
    goLive();
    renderRoute("/live");
    await vi.waitFor(() => {
      expect(FakeSocket.instances).toHaveLength(1);
    });
    expect(await screen.findByText("Connected")).toBeVisible();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => {
      FakeSocket.instances[0]?.close();
    });
    expect(screen.getByText("Reconnecting…")).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    vi.useRealTimers();

    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("offers a retry when the live status cannot be read", async () => {
    server.use(http.get("*/api/v1/live", () => HttpResponse.error()));
    renderRoute("/live");

    expect(await screen.findByRole("button", { name: /retry/i })).toBeVisible();
  });

  it("marks the live entry of the menu while a session runs", async () => {
    goLive();
    renderRoute("/model");

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(await within(nav).findByRole("link", { name: /^Live\s*\(Live\)$/ })).toBeVisible();
  });
});
