import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { events } from "@/test/fixtures/events";
import { renderRoute, renderWithProviders } from "@/test/render";
import { server, SESSION_ID } from "@/test/server";

import { GoFurther, RacePreview, ResultFacts } from "./EventExtras";
import { MemoryRouter } from "react-router";

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
});
