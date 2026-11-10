import type { Schema } from "@stintline/api-types";

import { compoundInfo } from "@/lib/compounds";
import type { Formatters } from "@/lib/format";
import { eventName } from "@/lib/i18n/content";
import type { I18nValue } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/locale";

export type Report = Schema<"RaceReport">;
type Entry = Schema<"ReportEntry">;

export interface WrittenReport {
  title: string;
  lede: string;
  paragraphs: string[];
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

/**
 * Turns the facts of a race report into sentences. Every sentence comes from the
 * dictionaries, so English and French read naturally; nothing is invented beyond the data.
 */
export function writeReport(
  report: Report,
  t: I18nValue["t"],
  f: Formatters,
  locale: Locale,
): WrittenReport {
  const gp = eventName(report.event.name, locale);
  const sprint = report.kind === "SPRINT";
  const winner = report.winner;
  const [, second, third] = report.podium;

  const title = t(sprint ? "report.title.sprint" : "report.title.race", {
    winner: fullName(winner),
    gp,
  });

  const lede: string[] = [];
  if (second) {
    const params = {
      winner: surname(winner),
      team: winner.team.name,
      second: surname(second.entry),
      gap: second.gap_s == null ? "" : f.seconds(second.gap_s, 3),
    };
    lede.push(t(second.gap_s == null ? "report.lede.noGap" : "report.lede", params));
  }
  if (third) lede.push(t("report.third", { third: surname(third.entry) }));
  const grid = winner.grid_position;
  if (grid === 1) lede.push(t("report.fromPole", { winner: surname(winner) }));
  else if (grid === 0) lede.push(t("report.fromPitLane", { winner: surname(winner) }));
  else if (grid != null) {
    lede.push(t("report.fromGrid", { winner: surname(winner), grid: f.ordinal(grid) }));
  }
  if (report.winner_wins === 1) lede.push(t("report.firstWin", { winner: surname(winner) }));
  else if (report.winner_wins != null) {
    lede.push(t("report.nthWin", { winner: surname(winner), n: f.ordinal(report.winner_wins) }));
  }

  const paragraphs: string[] = [];
  const strategy = report.winner_strategy;
  if (strategy) {
    const tyres = strategy.compounds
      .map((c) => t(`compoundLower.${compoundInfo(c).key}`))
      .join(" → ");
    paragraphs.push(
      strategy.stops === 0
        ? t("report.noStop", { winner: surname(winner), tyres })
        : t(strategy.stops === 1 ? "report.oneStop" : "report.stops", {
            winner: surname(winner),
            n: strategy.stops,
            tyres,
          }),
    );
  }

  const n = report.neutralisations;
  if (report.rain) paragraphs.push(t("report.rain"));
  if (n) {
    const parts = [
      [n.safety_cars, "report.sc"],
      [n.virtual_safety_cars, "report.vsc"],
      [n.red_flags, "report.red"],
    ] as const;
    const said = parts
      .filter(([count]) => count > 0)
      .map(([count, key]) => t(`${key}.${count === 1 ? "one" : "other"}` as const, { n: count }));
    paragraphs.push(
      said.length === 0 ? t("report.clean") : t("report.neutralised", { what: list(said, locale) }),
    );
  }

  const facts: string[] = [];
  const climb = report.biggest_gain;
  if (climb?.grid_position != null && climb.finish_position != null) {
    facts.push(
      t("report.climb", {
        driver: fullName(climb),
        grid: climb.grid_position === 0 ? t("report.pitLane") : f.ordinal(climb.grid_position),
        finish: f.ordinal(climb.finish_position),
      }),
    );
  }
  const fastest = report.fastest_lap;
  if (fastest?.fastest_lap_s != null) {
    facts.push(
      t("report.fastest", { driver: fullName(fastest), time: f.lapTime(fastest.fastest_lap_s) }),
    );
  }
  if (report.retirements.length > 0) {
    facts.push(
      t(report.retirements.length === 1 ? "report.retired.one" : "report.retired.other", {
        n: report.retirements.length,
        drivers: list(report.retirements.map(surname), locale),
      }),
    );
  }
  if (facts.length > 0) paragraphs.push(facts.join(" "));

  const points = (value: number) => f.number(value, Number.isInteger(value) ? 0 : 1);
  const title_ = report.championship;
  if (title_?.second && title_.lead != null) {
    paragraphs.push(
      t(title_.leader_changed ? "report.lead.new" : "report.lead.kept", {
        leader: `${title_.leader.given_name} ${title_.leader.family_name}`,
        points: points(title_.points),
        lead: points(title_.lead),
        second: title_.second.family_name,
        round: title_.round,
      }),
    );
  }

  return { title, lede: lede.join(" "), paragraphs };
}
