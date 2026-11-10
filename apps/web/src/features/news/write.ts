import type { Schema } from "@stintline/api-types";

import { compoundInfo } from "@/lib/compounds";
import type { Formatters } from "@/lib/format";
import { eventName } from "@/lib/i18n/content";
import type { I18nValue } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/locale";

export type Report = Schema<"RaceReport">;
type Entry = Schema<"ReportEntry">;
type T = I18nValue["t"];

export type SectionKey = "start" | "race" | "strategy" | "facts" | "championship";

export interface Section {
  key: SectionKey;
  sentences: string[];
}

export interface WrittenReport {
  title: string;
  lede: string;
  sections: Section[];
}

function fullName(entry: Entry): string {
  return `${entry.driver.given_name} ${entry.driver.family_name}`;
}

function surname(entry: Entry): string {
  return entry.driver.family_name;
}

function list(items: string[], locale: Locale): string {
  return new Intl.ListFormat(locale === "fr" ? "fr-FR" : "en-GB", { type: "conjunction" }).format(
    items,
  );
}

function points(f: Formatters, value: number): string {
  return f.number(value, Number.isInteger(value) ? 0 : 1);
}

function lede(report: Report, t: T, f: Formatters): string {
  const winner = report.winner;
  const [, second, third] = report.podium;
  const out: string[] = [];
  if (second) {
    const params = {
      winner: surname(winner),
      team: winner.team.name,
      second: surname(second.entry),
      gap: second.gap_s == null ? "" : f.seconds(second.gap_s, 3),
    };
    out.push(t(second.gap_s == null ? "report.lede.noGap" : "report.lede", params));
  }
  if (third) out.push(t("report.third", { third: surname(third.entry) }));
  const grid = winner.grid_position;
  if (grid === 1) out.push(t("report.fromPole", { winner: surname(winner) }));
  else if (grid === 0) out.push(t("report.fromPitLane", { winner: surname(winner) }));
  else if (grid != null) {
    out.push(t("report.fromGrid", { winner: surname(winner), grid: f.ordinal(grid) }));
  }
  if (report.winner_wins === 1) out.push(t("report.firstWin", { winner: surname(winner) }));
  else if (report.winner_wins != null) {
    out.push(t("report.nthWin", { winner: surname(winner), n: f.ordinal(report.winner_wins) }));
  }
  return out.join(" ");
}

function start(report: Report, t: T, f: Formatters, locale: Locale): string[] {
  const out: string[] = [];
  const story = report.story;
  if (story && story.start_gains.length > 0) {
    out.push(
      t("report.start.gains", {
        moves: list(
          story.start_gains.map((m) =>
            t("report.start.move", {
              driver: surname(m.entry),
              n: m.grid - m.position,
              grid: f.ordinal(m.grid),
              position: f.ordinal(m.position),
            }),
          ),
          locale,
        ),
      }),
    );
  }
  const loss = story?.start_losses[0];
  if (loss) {
    out.push(
      t("report.start.loss", {
        driver: surname(loss.entry),
        n: loss.position - loss.grid,
        grid: f.ordinal(loss.grid),
        position: f.ordinal(loss.position),
      }),
    );
  }
  const weather = report.weather;
  if (weather) {
    out.push(
      t("report.weather", {
        air: f.number(weather.air_max, 0),
        track: f.number(weather.track_max, 0),
      }),
    );
  }
  if (report.rain) out.push(t("report.rain"));
  return out;
}

function race(report: Report, t: T, locale: Locale): string[] {
  const out: string[] = [];
  const winner = surname(report.winner);
  const story = report.story;
  if (story && story.leaders.length > 1) {
    out.push(
      t("report.leaders", {
        leaders: list(
          story.leaders.map((l) => t("report.leader", { driver: surname(l.entry), n: l.laps })),
          locale,
        ),
        changes: story.lead_changes,
      }),
    );
  }
  const decisive = story?.decisive;
  if (decisive) {
    const rival = decisive.rival ? surname(decisive.rival) : "";
    out.push(t(`report.decisive.${decisive.how}`, { winner, rival, lap: decisive.lap }));
  }
  const n = report.neutralisations;
  if (n) {
    const parts = [
      [n.safety_cars, "report.sc"],
      [n.virtual_safety_cars, "report.vsc"],
      [n.red_flags, "report.red"],
    ] as const;
    const said = parts
      .filter(([count]) => count > 0)
      .map(([count, key]) => t(`${key}.${count === 1 ? "one" : "other"}` as const, { n: count }));
    out.push(
      said.length === 0 ? t("report.clean") : t("report.neutralised", { what: list(said, locale) }),
    );
  }
  return out;
}

function strategy(report: Report, t: T, f: Formatters): string[] {
  const out: string[] = [];
  const plan = report.winner_strategy;
  const winner = surname(report.winner);
  if (plan) {
    const tyres = plan.compounds.map((c) => t(`compoundLower.${compoundInfo(c).key}`)).join(" → ");
    out.push(
      plan.stops === 0
        ? t("report.noStop", { winner, tyres })
        : t(plan.stops === 1 ? "report.oneStop" : "report.stops", {
            winner,
            n: plan.stops,
            tyres,
          }),
    );
  }
  const pits = report.pit_stops;
  if (pits) {
    out.push(t("report.pits.total", { n: pits.total }));
    const best = pits.fastest;
    if (best) {
      out.push(
        t(best.measure === "stationary" ? "report.pits.fastest" : "report.pits.fastestLane", {
          team: best.entry.team.name,
          driver: surname(best.entry),
          time: f.seconds(best.duration_s, 1),
          lap: best.lap,
        }),
      );
    }
  }
  return out;
}

function facts(report: Report, t: T, f: Formatters, locale: Locale): string[] {
  const out: string[] = [];
  const climb = report.biggest_gain;
  if (climb?.grid_position != null && climb.finish_position != null) {
    out.push(
      t("report.climb", {
        driver: fullName(climb),
        grid: climb.grid_position === 0 ? t("report.pitLane") : f.ordinal(climb.grid_position),
        finish: f.ordinal(climb.finish_position),
      }),
    );
  }
  const fastest = report.fastest_lap;
  if (fastest?.fastest_lap_s != null) {
    out.push(
      t("report.fastest", { driver: fullName(fastest), time: f.lapTime(fastest.fastest_lap_s) }),
    );
  }
  if (report.retirements.length > 0) {
    out.push(
      t(report.retirements.length === 1 ? "report.retired.one" : "report.retired.other", {
        n: report.retirements.length,
        drivers: list(report.retirements.map(surname), locale),
      }),
    );
  }
  return out;
}

function championship(report: Report, t: T, f: Formatters, locale: Locale): string[] {
  const out: string[] = [];
  const title = report.championship;
  if (title?.second && title.lead != null) {
    out.push(
      t(title.leader_changed ? "report.lead.new" : "report.lead.kept", {
        leader: `${title.leader.given_name} ${title.leader.family_name}`,
        points: points(f, title.points),
        lead: points(f, title.lead),
        second: title.second.family_name,
        round: title.round,
      }),
    );
  }
  if (report.teams.length > 0) {
    out.push(
      t("report.teams", {
        teams: list(
          report.teams.map((row) =>
            t("report.teamPoints", { team: row.team.name, points: points(f, row.points) }),
          ),
          locale,
        ),
      }),
    );
  }
  return out;
}

/**
 * Turns the facts of a race report into an article. Every sentence comes from the
 * dictionaries, so English and French read naturally; nothing is invented beyond the data,
 * and a sentence is left out when its data is missing.
 */
export function writeReport(report: Report, t: T, f: Formatters, locale: Locale): WrittenReport {
  const gp = eventName(report.event.name, locale);
  const title = t(report.kind === "SPRINT" ? "report.title.sprint" : "report.title.race", {
    winner: fullName(report.winner),
    gp,
  });
  const sections: Section[] = [
    { key: "start", sentences: start(report, t, f, locale) },
    { key: "race", sentences: race(report, t, locale) },
    { key: "strategy", sentences: strategy(report, t, f) },
    { key: "facts", sentences: facts(report, t, f, locale) },
    { key: "championship", sentences: championship(report, t, f, locale) },
  ];
  return {
    title,
    lede: lede(report, t, f),
    sections: sections.filter((s) => s.sentences.length > 0),
  };
}

/** Every sentence of the article body, in order. */
export function bodyText(written: WrittenReport): string[] {
  return written.sections.flatMap((s) => s.sentences);
}
