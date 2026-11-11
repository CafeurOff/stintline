import type { Schema } from "@stintline/api-types";
import { screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { events } from "@/test/fixtures/events";
import { renderWithProviders } from "@/test/render";

import { GrandPrixCard } from "./components/GrandPrixCard";

const base = events.results[0];
if (!base) throw new Error("no event fixture");
const upcoming: Schema<"Event"> = {
  ...base,
  winner: null,
  format: "sprint",
  sessions: [
    { id: 1, kind: "R" as const, scheduled_start: "2099-03-16T04:00:00Z", has_data: false },
  ],
};

function renderCard(isNext: boolean) {
  const router = createMemoryRouter([
    { path: "/", element: <GrandPrixCard event={upcoming} isNext={isNext} now={0} /> },
  ]);
  renderWithProviders(<RouterProvider router={router} />);
}

describe("GrandPrixCard", () => {
  it("marks the next Grand Prix with a countdown to the race", () => {
    renderCard(true);

    expect(screen.getByText(/^Next/)).toBeVisible();
    expect(screen.getByRole("timer")).toBeVisible();
    expect(screen.getByText("Sprint")).toBeVisible();
  });

  it("shows later Grands Prix as coming up, with the race start", () => {
    renderCard(false);

    expect(screen.getByText("Coming up")).toBeVisible();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("Race")).toBeVisible();
  });
});
