import type { Schema } from "@stintline/api-types";
import {
  ArrowRight,
  CalendarDays,
  Flag as FlagIcon,
  Siren,
  Timer,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Face } from "@/components/dash/Face";
import { Panel, Tile } from "@/components/dash/Panel";
import { Flag } from "@/components/racing/Flag";
import { initials } from "@/components/racing/initials";
import { compoundInfo } from "@/lib/compounds";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

/**
 * A race in key figures and facts, built from its report (ADR 0012): the tiles of the home
 * page and the Grand Prix page, and the filterable facts panel.
 */

type Report = Schema<"RaceReport">;

/** Facts shown at once: the column stays as tall as the tables next to it. */
const FACTS_SHOWN = 4;

function codeOf(driver: Schema<"Driver">): string {
  return driver.code ?? initials(driver.given_name, driver.family_name);
}

export function FastestStopTile({ report }: { report: Report }) {
  const { t, f } = useI18n();
  const stop = report.pit_stops?.fastest;
  if (!stop) return null;
  return (
    <Tile label={t("dash.fastestStop")} icon={<Wrench className="size-4" />}>
      <p className="num text-4xl font-semibold">{f.seconds(stop.duration_s, 2)}</p>
      <DriverLine entry={stop.entry} />
    </Tile>
  );
}

export function ClimberTile({ entry }: { entry: Schema<"ReportEntry"> }) {
  const { t } = useI18n();
  const gained = (entry.grid_position ?? 0) - (entry.finish_position ?? 0);
  return (
    <Tile label={t("dash.climber")} icon={<TrendingUp className="size-4" />}>
      <p className="flex items-baseline gap-3">
        <span className="num text-4xl font-semibold text-gain">+{gained}</span>
        <span className="num text-sm text-muted">
          {t("dash.climb", {
            grid: entry.grid_position ?? "?",
            finish: entry.finish_position ?? "?",
          })}
        </span>
      </p>
      <DriverLine entry={entry} />
    </Tile>
  );
}

export function FastestLapTile({ entry }: { entry: Schema<"ReportEntry"> }) {
  const { t, f } = useI18n();
  return (
    <Tile label={t("dash.fastestLap")} icon={<Timer className="size-4" />}>
      <p className="num text-4xl font-semibold text-t-purple">{f.lapTime(entry.fastest_lap_s)}</p>
      <DriverLine entry={entry} />
    </Tile>
  );
}

export function RaceControlTile({ report }: { report: Report }) {
  const { t } = useI18n();
  const n = report.neutralisations;
  const counts = [
    ["SC", n?.safety_cars ?? 0, "bg-t-yellow text-tyre-ink"],
    ["VSC", n?.virtual_safety_cars ?? 0, "bg-t-yellow/70 text-tyre-ink"],
    ["RED", n?.red_flags ?? 0, "bg-mark text-white"],
  ] as const;
  return (
    <Tile label={t("dash.raceControl")} icon={<Siren className="size-4" />}>
      <div className="flex gap-2">
        {counts.map(([label, count, tone]) => (
          <span
            key={label}
            className={`flex flex-1 flex-col items-center rounded-lg py-1.5 ${
              count > 0 ? tone : "bg-raised text-muted"
            }`}
          >
            <span className="num text-2xl leading-none font-semibold">{count}</span>
            <span className="text-[0.65rem] font-bold">{label}</span>
          </span>
        ))}
      </div>
      <p className="mt-auto flex items-center gap-1.5 text-xs text-muted">
        <FlagIcon aria-hidden="true" className="size-3.5" />
        {t("dash.leadChanges", { n: report.story?.lead_changes ?? 0 })}
      </p>
    </Tile>
  );
}

function DriverLine({ entry }: { entry: Schema<"ReportEntry"> }) {
  return (
    <Link
      to={`/drivers/${entry.driver.ref}`}
      className="mt-auto flex items-center gap-2 text-sm hover:underline"
    >
      <Face
        url={entry.driver.photo_url}
        label={codeOf(entry.driver)}
        colour={entry.team_colour}
        className="size-7 shrink-0 rounded-full text-[0.6rem]"
      />
      <span className="truncate">
        <span className="font-semibold">{entry.driver.family_name}</span>
        <span className="text-muted"> · {entry.team.name}</span>
      </span>
    </Link>
  );
}

type Tag = "driver" | "team" | "race";

interface Fact {
  key: string;
  tag: Tag;
  title: string;
  body: string;
}

function useFacts(report: Report): Fact[] {
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

const TAG_TONE: Record<Tag, string> = {
  driver: "bg-t-blue/15 text-t-blue",
  team: "bg-gain/15 text-gain",
  race: "bg-t-yellow/15 text-t-yellow",
};

const FILTERS = ["all", "driver", "team", "race"] as const;

export function FactsPanel({
  report,
  limit = FACTS_SHOWN,
  title,
}: {
  report: Report;
  /** Facts shown at once (the home page keeps the column short). */
  limit?: number;
  title?: string;
}) {
  const { t, f, locale } = useI18n();
  const facts = useFacts(report);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const shown = facts.filter((x) => filter === "all" || x.tag === filter).slice(0, limit);
  return (
    <Panel
      id="home-facts"
      title={title ?? t("dash.facts")}
      icon={<Zap className="size-5" />}
      action={
        <div role="group" aria-label={t("dash.facts")} className="flex gap-1">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
              }}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-muted aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
            >
              {value === "all" ? t("dash.all") : t(`dash.tag.${value}`)}
            </button>
          ))}
        </div>
      }
    >
      <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
        {shown.map((fact) => (
          <li
            key={fact.key}
            className="flex flex-col gap-2 rounded-lg border border-line bg-raised/50 p-4"
          >
            <span
              className={`w-fit rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase ${TAG_TONE[fact.tag]}`}
            >
              {t(`dash.tag.${fact.tag}`)}
            </span>
            <p className="leading-snug font-bold">{fact.title}</p>
            {fact.body && <p className="text-sm text-muted">{fact.body}</p>}
            <p className="mt-auto flex items-center justify-between pt-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <Flag country={report.event.circuit.country} />
                {report.event.circuit.locality}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                {f.date(report.event.race_date)}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <Link
        to={`/news/${String(report.session_id)}`}
        className="mt-auto flex items-center justify-center gap-2 border-t border-line py-3 text-sm font-semibold hover:bg-raised"
      >
        {t("home.report")} · {eventName(report.event.name, locale)}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Panel>
  );
}
