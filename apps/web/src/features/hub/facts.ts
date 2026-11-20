import type { Schema } from "@stintline/api-types";

import { compoundInfo } from "@/lib/compounds";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

/** The facts of a race built from its report (ADR 0012), shared by the facts panels. */

type Report = Schema<"RaceReport">;

export type Tag = "driver" | "team" | "race";

interface Fact {
  key: string;
  tag: Tag;
  title: string;
  body: string;
}

export function useFacts(report: Report): Fact[] {
  const { t, f, locale } = useI18n();
  const facts: Fact[] = [];
  const race = eventName(report.event.name, locale);
  const winner = report.winner;
  const second = report.podium[1];
  const margin = second?.gap_s != null ? f.seconds(second.gap_s, 3) : "";
  facts.push({
    key: "win",
    tag: "driver",
    title: t("dash.fact.win", {
      driver: `${winner.driver.given_name} ${winner.driver.family_name}`,
      race,
    }),
    body:
      report.winner_wins != null
        ? t("dash.fact.winBody", {
            team: winner.team.name,
            margin,
            second: second?.entry.driver.family_name ?? "",
            wins: report.winner_wins,
          })
        : t("dash.fact.winBodyNoCount", {
            team: winner.team.name,
            margin,
            second: second?.entry.driver.family_name ?? "",
          }),
  });
  const champ = report.championship;
  if (champ) {
    facts.push({
      key: "leader",
      tag: "driver",
      title: champ.leader_changed
        ? t("dash.fact.leaderNew", { driver: champ.leader.family_name })
        : t("dash.fact.leader", { driver: champ.leader.family_name, lead: champ.lead ?? 0 }),
      body: t("dash.fact.leaderBody", { points: f.number(champ.points, 0), round: champ.round }),
    });
  }
  const [bestTeam, nextTeam] = report.teams;
  if (bestTeam) {
    facts.push({
      key: "team",
      tag: "team",
      title: t("dash.fact.team", { team: bestTeam.team.name, points: bestTeam.points }),
      body: nextTeam
        ? t("dash.fact.teamBody", { second: nextTeam.team.name, secondPoints: nextTeam.points })
        : "",
    });
  }
  const gain = report.biggest_gain;
  if (gain?.grid_position != null && gain.finish_position != null) {
    facts.push({
      key: "climb",
      tag: "driver",
      title: t("dash.fact.climb", {
        driver: gain.driver.family_name,
        places: gain.grid_position - gain.finish_position,
      }),
      body: t("dash.fact.climbBody", {
        grid: gain.grid_position,
        finish: gain.finish_position,
        team: gain.team.name,
      }),
    });
  }
  const strategy = report.winner_strategy;
  if (strategy) {
    facts.push({
      key: "strategy",
      tag: "race",
      title: t("dash.fact.strategy", { stops: strategy.stops }),
      body: t("dash.fact.strategyBody", {
        compounds: strategy.compounds
          .map((c) => t(`compound.${compoundInfo(c).key}`).toLowerCase())
          .join(" → "),
      }),
    });
  }
  const pits = report.pit_stops;
  if (pits?.fastest) {
    facts.push({
      key: "stop",
      tag: "team",
      title: t("dash.fact.stop", { time: f.seconds(pits.fastest.duration_s, 2) }),
      body: t("dash.fact.stopBody", {
        driver: pits.fastest.entry.driver.family_name,
        team: pits.fastest.entry.team.name,
        lap: pits.fastest.lap,
        total: pits.total,
      }),
    });
  }
  if (report.retirements.length > 0) {
    facts.push({
      key: "dnf",
      tag: "race",
      title: t("dash.fact.dnf", { n: report.retirements.length }),
      body: report.retirements
        .map((r) => `${r.driver.family_name}${r.status ? ` (${r.status})` : ""}`)
        .join(", "),
    });
  }
  return facts;
}

export const FILTERS = ["all", "driver", "team", "race"] as const;
