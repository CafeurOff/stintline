import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";

import { circuits } from "@/test/fixtures/analysis";
import { events } from "@/test/fixtures/events";
import { session } from "@/test/fixtures/session";
import { renderRoute, renderWithProviders } from "@/test/render";
import { server, SESSION_ID } from "@/test/server";

import { GoFurther, RacePreview, ResultFacts } from "./EventExtras";

describe("Grand Prix extras", () => {
  it("previews a race to come with the circuit figures and the last editions", async () => {
    renderWithProviders(
      <MemoryRouter>
        <RacePreview circuitRef="albert_park" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("What to expect")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track DNA" })).toHaveAttribute(
      "href",
      "/circuits/albert_park",
    );
    expect(screen.getByRole("button", { name: "pit loss" })).toBeInTheDocument();
  });

  it("tells a race in facts from its results alone", async () => {
    renderWithProviders(
      <MemoryRouter>
        <ResultFacts sessionId={SESSION_ID} />
      </MemoryRouter>,
    );

    const panel = await screen.findByText("The race in facts");
    const list = within(panel.closest("section") ?? document.body);
    expect(list.getByText(/wins for/)).toBeInTheDocument();
    expect(list.getByText(/finishers on the winner's lap/)).toBeInTheDocument();
  });

  it("links a Grand Prix to the analysis pages of the same race", async () => {
    renderWithProviders(
      <MemoryRouter>
        <GoFurther
          season={2025}
          round={14}
          eventId={14}
          circuitRef="albert_park"
          raceId={SESSION_ID}
          timed
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Race pace" })).toHaveAttribute(
      "href",
      `/analysis/pace?season=2025&session=${String(SESSION_ID)}`,
    );
    expect(screen.getByRole("link", { name: "FIA documents" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Track DNA" })).toBeInTheDocument();
  });

  it("shows the preview on the page of a Grand Prix still to run", async () => {
    const first = events.results[0];
    if (!first) throw new Error("no event fixture");
    const future = { ...first, race_date: "2999-03-16", winner: null };
    server.use(http.get("*/api/v1/events/:id", () => HttpResponse.json(future)));

    renderRoute(`/events/${String(future.id)}`);

    expect(await screen.findByText("What to expect")).toBeInTheDocument();
  });

  it("tells pole, climbers and retirements apart", async () => {
    const [first, second, third, ...rest] = [...session.entries].sort(
      (a, b) => a.finish_position - b.finish_position,
    );
    if (!first || !second || !third) throw new Error("short fixture");
    const entries = [
      { ...first, grid_position: 1, finish_position: 1, classification: "1", race_time_s: 5000 },
      { ...second, grid_position: 9, finish_position: 2, classification: "2", race_time_s: 5004 },
      { ...third, grid_position: 2, finish_position: null, classification: "R", status: "Gearbox" },
      ...rest.slice(0, 2).map((e) => ({ ...e, classification: "W", status: "Did not start" })),
    ];
    server.use(http.get("*/api/v1/sessions/:id", () => HttpResponse.json({ ...session, entries })));

    renderWithProviders(
      <MemoryRouter>
        <ResultFacts sessionId={SESSION_ID} />
      </MemoryRouter>,
      { locale: "fr" },
    );

    expect(await screen.findByText(/depuis la pole position/)).toBeInTheDocument();
    expect(screen.getByText(/gagne 7 places/)).toBeInTheDocument();
    expect(screen.getByText(/Boîte de vitesses \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/4,000\ss d'avance/)).toBeInTheDocument();
  });

  it("previews a circuit with few figures", async () => {
    const bare = circuits[0];
    if (!bare) throw new Error("no circuit fixture");
    server.use(
      http.get("*/api/v1/analysis/circuits", () =>
        HttpResponse.json([
          {
            ...bare,
            pit_loss_s: null,
            degradation_s_per_lap: null,
            races: 0,
            fastest_lap_s: null,
            history: [],
          },
        ]),
      ),
    );

    renderWithProviders(
      <MemoryRouter>
        <RacePreview circuitRef={bare.circuit.ref} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("What to expect")).toBeInTheDocument();
    expect(screen.queryByText("The last editions")).not.toBeInTheDocument();
  });

  it("previews nothing for a circuit without figures", () => {
    const { container } = renderWithProviders(
      <MemoryRouter>
        <RacePreview circuitRef="nowhere" />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not link pace pages for races without timing", () => {
    renderWithProviders(
      <MemoryRouter>
        <GoFurther
          season={1988}
          round={3}
          eventId={1}
          circuitRef="monaco"
          raceId={9}
          timed={false}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Race pace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "FIA documents" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Standings after this round" })).toBeInTheDocument();
  });
});
