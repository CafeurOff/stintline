import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { decisions } from "@/test/fixtures/paddock";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import { penaltyTags, retryDelayMs } from "./penalties";

vi.mock("./components/PdfViewer", () => ({
  PdfViewer: ({ title }: { title: string }) => <p>PDF of {title}</p>,
}));

/** Several clicks on a page with charts: slower than one query under coverage. */
const SLOW_MS = 15_000;

describe("FIA documents page", () => {
  it("shows the weekend's documents, tiles and the first document", async () => {
    renderRoute("/documents?season=2025");

    expect(await screen.findByRole("heading", { name: "FIA documents", level: 1 })).toBeVisible();
    expect(await screen.findByRole("region", { name: "Penalties" })).toHaveTextContent("4");
    const list = screen.getByRole("region", { name: "Documents" });
    await within(list).findByRole("button", { name: /Final Race Classification/ });
    expect(within(list).getAllByRole("button").length).toBeGreaterThan(40);
    expect(await screen.findByText(/^PDF of /)).toBeVisible();
  });

  it(
    "opens a decision with its ruling, lap and text",
    async () => {
      const { router } = renderRoute("/documents?season=2025");

      const list = await screen.findByRole("region", { name: "Documents" });
      await userEvent.click(await within(list).findByRole("button", { name: /Erratic Driving/ }));

      expect(router.state.location.search).toContain("doc=");
      const ruling = await screen.findByRole("region", { name: "Stewards' ruling" });
      expect(within(ruling).getByText("+5 s")).toBeVisible();
      expect(within(ruling).getByText("1 pts")).toBeVisible();
      expect(within(ruling).getByRole("link", { name: /Lap \d+/ })).toHaveAttribute(
        "href",
        expect.stringContaining("drivers=16") as string,
      );

      await userEvent.click(screen.getByRole("radio", { name: "Text" }));
      // The full text of the PDF is shown under the ruling.
      expect(screen.getAllByText(/moved twice/).some((el) => el.tagName === "PRE")).toBe(true);
    },
    SLOW_MS,
  );

  it(
    "searches the documents and shows where the words were found",
    async () => {
      const { router } = renderRoute("/documents?season=2025");

      await userEvent.type(await screen.findByRole("searchbox"), "moved twice");
      await userEvent.click(screen.getByRole("button", { name: "Search" }));

      expect(router.state.location.search).toContain("q=moved+twice");
      expect(
        await screen.findByRole("region", { name: "Results for “moved twice”" }),
      ).toBeVisible();
      expect(screen.getAllByText(/moved twice/).length).toBeGreaterThan(0);
    },
    SLOW_MS,
  );

  it(
    "filters by category and opens decisions from the table",
    async () => {
      const { router } = renderRoute("/documents?season=2025");

      const list = await screen.findByRole("region", { name: "Documents" });
      await userEvent.click(within(list).getByRole("button", { name: "Infringement" }));
      expect(router.state.location.search).toContain("cat=infringement");

      const table = await screen.findByRole("table", { name: "Stewards' decisions" });
      expect(within(table).getAllByRole("row")).toHaveLength(decisions.length + 1);
      const [read] = within(table).getAllByRole("button", { name: "Read" });
      if (!read) throw new Error("no decision to open");
      await userEvent.click(read);
      expect(router.state.location.search).toMatch(/doc=\d+/);
    },
    SLOW_MS,
  );

  it("explains an empty season", async () => {
    server.use(http.get("*/api/v1/documents/events", () => HttpResponse.json([])));
    renderRoute("/documents?season=2024");

    expect(await screen.findByText("No FIA documents for this season yet.")).toBeVisible();
  });

  it(
    "lists the stewards' decisions on the Grand Prix page and on the lap chart",
    async () => {
      const { container } = renderRoute("/events/14");

      expect(await screen.findByRole("region", { name: "Stewards' decisions" })).toBeVisible();
      await waitFor(() => {
        expect(container.querySelectorAll('[data-testid="lap-mark"]').length).toBeGreaterThan(0);
      });
    },
    SLOW_MS,
  );

  it(
    "lists a driver's decisions on the profile",
    async () => {
      server.use(http.get("*/api/v1/stewards/decisions", () => HttpResponse.json(decisions)));
      renderRoute("/drivers/norris");

      expect(
        await screen.findByRole("region", { name: /Stewards' decisions 20\d\d/ }),
      ).toBeVisible();
    },
    SLOW_MS,
  );
});

describe("penalty helpers", () => {
  it("lists the heaviest sanctions first", () => {
    const tags = penaltyTags({
      time_penalty_s: 5,
      penalty_points: 2,
      disqualified: true,
      reprimand: true,
      fine_eur: 5000,
      no_further_action: false,
      drive_through: true,
      stop_go_s: 10,
      grid_places: 3,
      back_of_grid: true,
      pit_lane_start: true,
      lap_time_deleted: true,
    });

    expect(tags.map((t) => t.key)).toEqual([
      "penalty.dsq",
      "penalty.driveThrough",
      "penalty.stopGo",
      "penalty.time",
      "penalty.grid",
      "penalty.backOfGrid",
      "penalty.pitLane",
      "penalty.lapDeleted",
      "penalty.points",
      "penalty.reprimand",
      "penalty.fine",
    ]);
    expect(penaltyTags({ no_further_action: true })).toEqual([
      { key: "penalty.nfa", tone: "neutral" },
    ]);
  });

  it("bounds the retry delay the relay asks for", () => {
    expect(retryDelayMs("4")).toBe(4000);
    expect(retryDelayMs("600")).toBe(30_000);
    expect(retryDelayMs(null)).toBe(10_000);
    expect(retryDelayMs("soon")).toBe(10_000);
  });
});
