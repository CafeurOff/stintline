import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { session } from "@/test/fixtures/session";
import { renderWithProviders } from "@/test/render";
import { problem, server, SESSION_ID } from "@/test/server";

import { resetWebGLCheck } from "@/features/telemetry/webgl";

import { byFinish, entriesByCar } from "../entries";
import type { TowerLine } from "../tower";
import { Race3DView } from "./Race3DView";
import { RaceTower } from "./RaceTower";
import { ReplayBar } from "./ReplayBar";

// The WebGL scene cannot run in jsdom: a stand-in shows what it was given.
vi.mock("./Race3DScene", () => ({
  default: ({
    camera,
    cars,
    ghost,
    label,
  }: {
    camera: string;
    cars: readonly { code: string }[];
    ghost: { code: string } | null;
    label: string;
  }) => (
    <div role="img" aria-label={label}>
      {camera} · {cars.length} cars · {ghost ? `ghost ${ghost.code}` : "no ghost"}
    </div>
  ),
}));

const entries = [...session.entries].sort(byFinish);
const byCar = entriesByCar(entries);
const [first, second, third] = entries;

function line(carNumber: number, position: number, extra: Partial<TowerLine> = {}): TowerLine {
  return {
    carNumber,
    position,
    progress: 10,
    toLeaderS: position === 1 ? null : position * 2,
    intervalS: position === 1 ? null : 1.5,
    lapsDown: 0,
    compound: "MEDIUM",
    tyreAge: 4,
    stops: 1,
    ...extra,
  };
}

describe("RaceTower", () => {
  const lines = [
    line(first?.car_number ?? 0, 1),
    line(second?.car_number ?? 0, 2),
    line(third?.car_number ?? 0, 3, { lapsDown: 1 }),
  ];

  it("shows gaps to the leader, then to the car ahead, and laps down", async () => {
    renderWithProviders(<RaceTower lines={lines} byCar={byCar} selected={0} onSelect={vi.fn()} />);
    const tower = screen.getByRole("region", { name: "Running order" });

    expect(within(tower).getByText("+4.0")).toBeVisible();
    expect(within(tower).getByText("+1 lap")).toBeVisible();
    await userEvent.click(within(tower).getByRole("button", { name: "Interval" }));
    expect(within(tower).getByText("+1.5")).toBeVisible();
    expect(within(tower).getByRole("button", { name: "Interval" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("picks the driver of a line", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<RaceTower lines={lines} byCar={byCar} selected={0} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /^2\. / }));

    expect(onSelect).toHaveBeenCalledWith(second?.car_number);
  });
});

describe("ReplayBar", () => {
  it("summarises the flag periods and the followed driver's stops", () => {
    renderWithProviders(
      <ReplayBar
        lap={20}
        totalLaps={70}
        finished={false}
        playing={false}
        speed={1}
        neutralisations={[
          { status: "SC", lap_start: 32, lap_end: 35 },
          { status: "RED", lap_start: 50, lap_end: null },
        ]}
        pitLaps={[18, 44]}
        onToggle={vi.fn()}
        onLap={vi.fn()}
        onSpeed={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Safety car from lap 32 to lap 35. Red flag from lap 50 to lap 70. Stops of the followed driver: laps 18, 44",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

describe("Race3DView", () => {
  const cars = [
    { carNumber: 4, code: "NOR", colour: "#ff8000", fraction: 0.3, selected: true },
    { carNumber: 81, code: "PIA", colour: "#ff8000", fraction: 0.2, selected: false },
  ];

  // Test files share one module graph (isolate: false), so Race3DView may already be bound
  // to the real WebGL check: answer it through the canvas instead of mocking the module.
  function webgl(available: boolean) {
    resetWebGLCheck();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      available ? ({} as WebGL2RenderingContext) : null,
    );
  }

  beforeEach(() => {
    webgl(true);
  });
  afterEach(() => {
    resetWebGLCheck();
  });

  it("draws the race on the fastest lap's track and switches cameras", async () => {
    renderWithProviders(
      <Race3DView
        sessionId={SESSION_ID}
        cars={cars}
        ghost={{ fraction: 0.1, code: "NOR" }}
        circuit="Hungaroring"
        onSelect={vi.fn()}
      />,
    );

    const scene = await screen.findByRole("img", { name: /Hungaroring in 3D/ });
    expect(scene).toHaveTextContent("top · 2 cars · ghost NOR");
    await userEvent.click(screen.getByRole("button", { name: "Chase" }));
    expect(scene).toHaveTextContent(/^chase/);
  });

  it("explains a race without telemetry", async () => {
    server.use(http.get("*/api/v1/sessions/:id/telemetry", () => HttpResponse.json([])));
    renderWithProviders(
      <Race3DView sessionId={SESSION_ID} cars={cars} ghost={null} circuit="X" onSelect={vi.fn()} />,
    );

    expect(await screen.findByText(/No fastest-lap telemetry/)).toBeVisible();
  });

  it("explains a failed load the same way", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/telemetry", () => problem(500, "server_error", "Error")),
    );
    renderWithProviders(
      <Race3DView sessionId={SESSION_ID} cars={cars} ghost={null} circuit="X" onSelect={vi.fn()} />,
    );

    expect(await screen.findByText(/No fastest-lap telemetry/)).toBeVisible();
  });

  it("keeps to the map in a browser without WebGL", () => {
    webgl(false);
    renderWithProviders(
      <Race3DView sessionId={SESSION_ID} cars={cars} ghost={null} circuit="X" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/cannot draw 3D/);
  });
});
