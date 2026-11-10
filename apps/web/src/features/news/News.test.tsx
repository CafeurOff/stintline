import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { createFormatters } from "@/lib/format";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { headlines, hungaryReport, sprintReport } from "@/test/fixtures/news";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import { bodyText, type Report, writeReport } from "./write";

function translator(dict: Record<string, string>) {
  return (key: string, params: Record<string, string | number> = {}) =>
    (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
}

const tEn = translator(en);
const tFr = translator(fr);

describe("writeReport", () => {
  const body = (report: Report, t = tEn, locale: "en" | "fr" = "en") =>
    bodyText(writeReport(report, t, createFormatters(locale), locale));

  it("tells the Hungarian Grand Prix in English, section by section", () => {
    const written = writeReport(hungaryReport, tEn, createFormatters("en"), "en");
    const text = bodyText(written).join(" ");

    expect(written.title).toBe("Lando Norris wins the Hungarian Grand Prix");
    expect(written.lede).toMatch(/^Norris \(McLaren\) beat Piastri by 0\.698\s?s\./);
    expect(written.lede).toContain("Russell completed the podium.");
    expect(written.lede).toContain("Norris had started 3rd on the grid.");
    expect(written.sections.map((s) => s.key)).toEqual([
      "start",
      "race",
      "strategy",
      "facts",
      "championship",
    ]);
    expect(text).toMatch(/^At the start, Albon gained 3 places \(19th to 16th after lap 1\)/);
    expect(text).toContain("Norris led 36 laps, Leclerc led 28 laps and Piastri led 6 laps");
    expect(text).toContain(
      "Norris took the lead for good on lap 46, when Piastri made a pit stop.",
    );
    expect(text).toContain("Norris stopped once: medium → hard.");
    expect(text).toContain("No safety car, no red flag: the race ran green from start to finish.");
    expect(text).toMatch(/Quickest stop: McLaren for Norris, 1\.9\s?s stationary/);
    expect(text).toContain("Best climb: Andrea Kimi Antonelli, from 15th to 10th.");
    expect(text).toContain("One retirement: Bearman.");
    expect(text).toContain(
      "Oscar Piastri still leads the championship after round 14, 284 points, 9 ahead of Norris.",
    );
    expect(text).toContain("On the constructors' side: McLaren 43 points");
  });

  it("tells the same race in French", () => {
    const written = writeReport(hungaryReport, tFr, createFormatters("fr"), "fr");

    expect(written.title).toBe("Lando Norris remporte le Grand Prix de Hongrie");
    expect(bodyText(written)).toContain("Norris a fait un arrêt : médium → durs.");
    expect(bodyText(written).join(" ")).toContain("lors de l'arrêt au stand de Piastri");
  });

  it("names a sprint and leaves out what it does not know", () => {
    const written = writeReport(sprintReport, tEn, createFormatters("en"), "en");

    expect(written.title).toBe("Oscar Piastri wins the Qatar Grand Prix sprint");
    expect(written.lede).toContain("from pole position");
    expect(written.lede).not.toMatch(/Grand Prix win/);
    expect(bodyText(written).join(" ")).not.toMatch(/championship|stopped|led \d+ laps/);
  });

  it("covers first wins, lapped runners-up, neutralisations and new leaders", () => {
    const [winner, second] = hungaryReport.podium;
    const report: Report = {
      ...hungaryReport,
      winner_wins: 1,
      winner: { ...hungaryReport.winner, grid_position: 0 },
      podium: winner && second ? [winner, { ...second, gap_s: null, laps_down: 1 }] : [],
      neutralisations: { safety_cars: 2, virtual_safety_cars: 1, red_flags: 0 },
      winner_strategy: { stops: 2, compounds: ["SOFT", "HARD", "SOFT"] },
      retirements: [hungaryReport.winner, hungaryReport.winner],
      biggest_gain: null,
      fastest_lap: null,
      championship: { ...hungaryReport.championship, leader_changed: true },
      rain: true,
    };

    const written = writeReport(report, tEn, createFormatters("en"), "en");
    const text = bodyText(written).join(" ");

    expect(written.lede).toContain("Norris (McLaren) finished ahead of Piastri.");
    expect(written.lede).toContain("from the pit lane");
    expect(written.lede).toContain("A first Grand Prix win for Norris.");
    expect(text).toContain("Norris stopped 2 times: soft → hard → soft.");
    expect(text).toContain("The race was neutralised by 2 safety cars and one virtual safety car.");
    expect(text).toContain("Rain fell during the race");
    expect(text).toContain("2 retirements: Norris and Norris.");
    expect(text).toMatch(/takes the championship lead/);
  });

  it.each([
    ["lights_to_flag", "Norris led every lap."],
    ["undercut", "A textbook undercut."],
    ["pit_cycle", "once Piastri, who had stayed out longer"],
    ["on_track", "took the lead from Piastri on track on lap 46"],
  ] as const)("explains how the lead was won: %s", (how, sentence) => {
    const story = hungaryReport.story;
    const report: Report = {
      ...hungaryReport,
      story: { ...story, decisive: { ...story.decisive, how } },
    };

    expect(body(report).join(" ")).toContain(sentence);
  });

  it("says when the winner never stopped, and lap-one losses", () => {
    const story = hungaryReport.story;
    const [loser] = story.start_losses;
    const report: Report = {
      ...hungaryReport,
      winner_strategy: { stops: 0, compounds: ["HARD"] },
      pit_stops: {
        ...hungaryReport.pit_stops,
        fastest: { ...hungaryReport.pit_stops.fastest, measure: "lane" },
      },
      story: { ...story, start_gains: [], start_losses: loser ? [loser] : [] },
    };

    const text = body(report).join(" ");

    expect(text).toContain("Norris did not stop, on hard tyres.");
    expect(text).toMatch(/lost 4 places on the opening lap/);
    expect(text).toMatch(/in the pit lane on lap/);
  });
});

describe("News page", () => {
  it("leads with the latest report and lists headlines in the page language", async () => {
    renderRoute("/news");

    expect(await screen.findByRole("heading", { level: 1, name: "News" })).toBeVisible();
    expect(
      await screen.findByRole("link", { name: "Lando Norris wins the Hungarian Grand Prix" }),
    ).toHaveAttribute("href", "/news/70");
    const list = await screen.findByRole("region", { name: "Headlines" });
    const links = await within(list).findAllByRole("link");
    const english = headlines.filter((h) => h.language === "en");
    expect(links).toHaveLength(english.length);
    expect(links[0]).toHaveAttribute("href", english[0]?.url);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows every language on demand and keeps it in the address", async () => {
    const { router } = renderRoute("/news");

    await userEvent.click(await screen.findByRole("radio", { name: "All" }));

    expect(router.state.location.search).toBe("?lang=all");
    const list = screen.getByRole("region", { name: "Headlines" });
    expect(await within(list).findAllByRole("link")).toHaveLength(headlines.length);
  });

  it("explains empty feeds and reports", async () => {
    server.use(
      http.get("*/api/v1/news/headlines", () => HttpResponse.json([])),
      http.get("*/api/v1/news/reports", () => HttpResponse.json([])),
    );
    renderRoute("/news");

    expect(await screen.findByText(/They are read every 30 minutes/)).toBeVisible();
    expect(await screen.findByText(/once a race is imported/)).toBeVisible();
  });

  it("offers a retry when the server fails", async () => {
    server.use(
      http.get("*/api/v1/news/headlines", () => HttpResponse.error()),
      http.get("*/api/v1/news/reports", () => HttpResponse.error()),
    );
    renderRoute("/news");

    await vi.waitFor(() => {
      expect(screen.getAllByRole("button", { name: /retry/i })).toHaveLength(2);
    });
  });
});

describe("Report page", () => {
  it("tells the race with its podium and links to the data", async () => {
    renderRoute("/news/70");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Lando Norris wins the Hungarian Grand Prix",
      }),
    ).toBeVisible();
    const podium = screen.getByRole("list", { name: "Podium" });
    expect(within(podium).getAllByRole("listitem")).toHaveLength(3);
    expect(within(podium).getByText(/\+0\.698/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Replay on the circuit" })).toHaveAttribute(
      "href",
      "/sessions/70",
    );
    expect(screen.getByRole("link", { name: "Full results" })).toHaveAttribute(
      "href",
      "/events/14",
    );
  });

  it("shows the problem when there is no report", async () => {
    renderRoute("/news/999");

    expect(await screen.findByText("No report for this session.")).toBeVisible();
  });
});

describe("Home page news", () => {
  it("shows the latest report and headlines", async () => {
    renderRoute("/");

    const news = await screen.findByRole("region", { name: "Latest news" });
    expect(
      await within(news).findByRole("link", { name: "Lando Norris wins the Hungarian Grand Prix" }),
    ).toBeVisible();
    expect(within(news).getByRole("link", { name: "All news →" })).toHaveAttribute("href", "/news");
  });
});

describe("Report page extras", () => {
  it("mentions rain and lists the other reports", async () => {
    server.use(
      http.get("*/api/v1/news/reports/:id", () =>
        HttpResponse.json({ ...hungaryReport, rain: true }),
      ),
    );
    renderRoute("/news/70");

    expect(await screen.findByText(/Rain fell during the race/)).toBeVisible();
    const others = await screen.findByRole("complementary", { name: "Other reports" });
    expect(
      await within(others).findByRole("link", {
        name: "Oscar Piastri wins the Qatar Grand Prix sprint",
      }),
    ).toHaveAttribute("href", `/news/${String(sprintReport.session_id)}`);
  });
});
