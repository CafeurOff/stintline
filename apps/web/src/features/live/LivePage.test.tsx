import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

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

  it("says where the selected driver would rejoin after a stop", async () => {
    goLive();
    const { router } = renderRoute("/live");

    await userEvent.click(await screen.findByRole("button", { name: /HAM/ }));

    expect(router.state.location.search).toBe("?car=44");
    const side = screen.getByRole("complementary");
    expect(within(side).getByRole("heading", { name: "If Hamilton pitted now?" })).toBeVisible();
    expect(within(side).getByText("Rejoins 12th")).toBeVisible();
  });

  it("plays team radio from the official recordings", async () => {
    goLive();
    renderRoute("/live");

    const radio = await screen.findAllByLabelText(/^Radio of /);
    expect(radio[0]).toHaveAttribute(
      "src",
      expect.stringContaining("livetiming.formula1.com/static/") as string,
    );
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

    expect(await screen.findByText("Lap 12/71")).toBeVisible();
    expect(screen.getByText("Safety car")).toBeVisible();
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
    expect(screen.getByText("Red flag")).toBeVisible();
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
